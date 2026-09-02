"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
const mailer_1 = require("../lib/mailer");
const email_queue_1 = require("../queue/email.queue");
const rate_limiter_1 = require("../services/rate-limiter");
const email_search_service_1 = require("../services/email-search.service");
const slack_1 = require("../lib/slack");
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 5);
// Threshold used ONLY by the startup recovery pass below.
// Must safely exceed lockDuration + (maxStalledCount * stalledInterval)
// so we never race against BullMQ's own in-flight stalled-job
// recovery for a still-legitimately-running job.
const STALE_PROCESSING_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const workerOptions = {
    connection: redis_1.redis,
    concurrency: WORKER_CONCURRENCY,
    lockDuration: 60000,
    // How often BullMQ scans for jobs whose lock has expired
    // (e.g. the worker process was killed mid-send). Any such
    // job is reclaimed and re-run by whichever worker is up.
    stalledInterval: 30000,
    // How many times a job is allowed to be recovered from a
    // stalled state before BullMQ gives up and marks it failed.
    maxStalledCount: 3,
};
/**
 * Startup recovery pass.
 *
 * BullMQ's own stalled-job detection (lockDuration + stalledInterval
 * + maxStalledCount above) already recovers a job that crashed
 * mid-send AS LONG AS its BullMQ job record still exists in Redis.
 * That covers the common case automatically — no code needed here.
 *
 * This function exists for the remaining edge case: a DB row stuck
 * at PROCESSING whose underlying BullMQ job is gone entirely (e.g.
 * it exhausted maxStalledCount before the worker came back, or the
 * job record was otherwise cleaned up). Those rows would otherwise
 * stay PROCESSING forever with nothing left in the queue to ever
 * pick them up again.
 *
 * Safety against duplicate sends: for every stale PROCESSING row,
 * we FIRST check whether its original job (`email-${id}`) is still
 * live in BullMQ (active/waiting/delayed). If it is, we do nothing
 * and let BullMQ's own mechanisms reconcile it — creating a second
 * job here would risk two workers sending the same email at once.
 * We only create a fresh job when the original is verifiably gone
 * (completed/failed/missing), so there is never more than one live
 * job per email at a time.
 */
function recoverStaleProcessingEmails() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const staleBefore = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
            const staleEmails = yield prisma_1.prisma.email.findMany({
                where: {
                    status: "PROCESSING",
                    OR: [
                        { processingStartedAt: null },
                        { processingStartedAt: { lt: staleBefore } },
                    ],
                },
            });
            if (staleEmails.length === 0) {
                return;
            }
            console.log(`Found ${staleEmails.length} stale PROCESSING email(s), checking recovery...`);
            for (const email of staleEmails) {
                const existingJob = yield email_queue_1.emailQueue.getJob(`email-${email.id}`);
                if (existingJob) {
                    const state = yield existingJob.getState();
                    const isLive = state === "active" ||
                        state === "waiting" ||
                        state === "delayed" ||
                        state === "waiting-children";
                    if (isLive) {
                        // Still a real, live BullMQ job — let BullMQ's own
                        // recovery handle it. Don't create a duplicate.
                        continue;
                    }
                }
                // Original job is gone (or never existed). Safe to reset
                // and re-queue as a fresh, immediate job.
                const reset = yield prisma_1.prisma.email.updateMany({
                    where: {
                        id: email.id,
                        status: "PROCESSING",
                    },
                    data: {
                        status: "SCHEDULED",
                        processingStartedAt: null,
                    },
                });
                if (reset.count === 0) {
                    // Already moved on (e.g. became SENT) between our
                    // read and this write — nothing to do.
                    continue;
                }
                yield email_queue_1.emailQueue.add("send-email", {
                    emailId: email.id,
                }, {
                    delay: 0,
                    jobId: `email-${email.id}-recover-${Date.now()}`,
                });
                console.log(`Recovered orphaned PROCESSING email ${email.id} — re-queued for immediate send.`);
            }
        }
        catch (error) {
            console.error("Startup recovery of stale PROCESSING emails failed:", error);
        }
    });
}
/**
 * Startup recovery pass, part 2.
 *
 * Covers a different failure mode than the PROCESSING recovery
 * above: a row still sitting at SCHEDULED, whose scheduledAt has
 * already passed, but whose underlying BullMQ job no longer
 * exists in Redis (e.g. Redis was restarted/flushed, or the
 * queue connection details changed since the job was created).
 * Postgres still has a jobId recorded, but that job is gone —
 * BullMQ has nothing left to ever dispatch, so without this,
 * the row would stay SCHEDULED forever with attempts still 0.
 *
 * Same duplicate-send safety approach as the PROCESSING recovery:
 * only re-queue if the original job is verifiably NOT live.
 */
function recoverOrphanedScheduledEmails() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const now = new Date();
            const dueEmails = yield prisma_1.prisma.email.findMany({
                where: {
                    status: "SCHEDULED",
                    scheduledAt: {
                        lte: now,
                    },
                },
            });
            if (dueEmails.length === 0) {
                return;
            }
            console.log(`Found ${dueEmails.length} overdue SCHEDULED email(s), checking for live jobs...`);
            for (const email of dueEmails) {
                const jobId = email.jobId || `email-${email.id}`;
                const existingJob = yield email_queue_1.emailQueue.getJob(jobId);
                let isLive = false;
                if (existingJob) {
                    const state = yield existingJob.getState();
                    isLive =
                        state === "active" ||
                            state === "waiting" ||
                            state === "delayed" ||
                            state === "waiting-children";
                }
                if (isLive) {
                    // Real, live job — BullMQ will dispatch it normally.
                    continue;
                }
                yield email_queue_1.emailQueue.add("send-email", {
                    emailId: email.id,
                }, {
                    delay: 0,
                    jobId: `email-${email.id}-recover-${Date.now()}`,
                });
                console.log(`Recovered orphaned SCHEDULED email ${email.id} (no live BullMQ job found) — re-queued for immediate send.`);
            }
        }
        catch (error) {
            console.error("Startup recovery of orphaned SCHEDULED emails failed:", error);
        }
    });
}
const worker = new bullmq_1.Worker("email-queue", (job) => __awaiter(void 0, void 0, void 0, function* () {
    const emailId = Number(job.data.emailId);
    console.log("--------------------------------");
    console.log(`Processing email ${emailId}`);
    console.log(`Job: ${job.id}`);
    console.log("--------------------------------");
    // ------------------------------------
    // 1. Fetch email
    // ------------------------------------
    const email = yield prisma_1.prisma.email.findUnique({
        where: {
            id: emailId,
        },
        include: {
            sender: true,
        },
    });
    if (!email) {
        throw new Error(`Email ${emailId} not found`);
    }
    // ------------------------------------
    // 2. Idempotency
    // ------------------------------------
    if (email.status === "SENT") {
        console.log(`Email ${email.id} already sent. Skipping.`);
        return {
            success: true,
            skipped: true,
            emailId: email.id,
        };
    }
    // ------------------------------------
    // 3. Minimum delay between sends
    //
    // Short waits are slept inline. A wait long enough to risk
    // exceeding this job's BullMQ lock (see MAX_INLINE_WAIT_MS
    // in rate-limiter.ts) is NOT slept inline — instead this job
    // is released and re-queued as a fresh delayed job for the
    // exact reserved time, so Redis holds the wait, not a live
    // process thread. Prevents false stalled-job detection under
    // burst load (e.g. many emails for the same sender due at once).
    // ------------------------------------
    const sendSlot = yield (0, rate_limiter_1.reserveSendSlot)(email.senderId);
    if (sendSlot.shouldDefer) {
        console.log(`Deferring email ${email.id} to ${sendSlot.nextSendAt.toISOString()} (min-delay spacing)`);
        yield email_queue_1.emailQueue.add("send-email", {
            emailId: email.id,
        }, {
            delay: sendSlot.waitMs,
            jobId: `email-${email.id}-delay-${sendSlot.nextSendAt.getTime()}`,
        });
        return {
            success: false,
            deferred: true,
            emailId: email.id,
            retryAt: sendSlot.nextSendAt.toISOString(),
        };
    }
    yield (0, rate_limiter_1.sleepForSendSlot)(sendSlot.waitMs);
    // ------------------------------------
    // 4. Hourly rate limit
    // ------------------------------------
    const rateLimit = yield (0, rate_limiter_1.acquireHourlyLimit)(email.senderId);
    if (!rateLimit.allowed) {
        const retryAt = rateLimit.retryAt;
        yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                scheduledAt: retryAt,
            },
        });
        const delay = Math.max(retryAt.getTime() - Date.now(), 1000);
        console.log(`Hourly limit reached for sender ${email.senderId}`);
        console.log(`Rescheduling email ${email.id} for ${retryAt.toISOString()}`);
        yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                scheduledAt: retryAt,
            },
        });
        const indianResumeTime = retryAt.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        });
        // Fire-and-forget: never let a Slack outage delay or
        // fail the actual reschedule below.
        yield (0, slack_1.notifySlack)(email.userId, `⚠️ *Hourly send limit reached*

         Email #${email.id} to ${email.to} has been rescheduled.

🕐 *Resume time:* ${indianResumeTime} IST`);
        console.log(`Slack notification requested for user ${email.userId}`);
        yield email_queue_1.emailQueue.add("send-email", {
            emailId: email.id,
        }, {
            delay,
            jobId: `email-${email.id}-retry-${retryAt.getTime()}`,
        });
        return {
            success: false,
            rateLimited: true,
            emailId: email.id,
            retryAt: retryAt.toISOString(),
        };
    }
    // ------------------------------------
    // 5. Atomically mark PROCESSING
    //
    // Allowed source states:
    //   - SCHEDULED   → normal first attempt
    //   - PROCESSING  → resuming after a stall (this same
    //                   BullMQ job, reclaimed via lock expiry;
    //                   BullMQ guarantees only one worker ever
    //                   holds a given job's lock at a time, so
    //                   this is never a live collision)
    //   - FAILED      → a BullMQ-configured retry attempt
    //                   (attempts + backoff in email.queue.ts)
    //                   re-running after a previous send error
    // ------------------------------------
    const processing = yield prisma_1.prisma.email.updateMany({
        where: {
            id: email.id,
            status: {
                in: ["SCHEDULED", "PROCESSING", "FAILED"],
            },
        },
        data: {
            status: "PROCESSING",
            processingStartedAt: new Date(),
            attempts: {
                increment: 1,
            },
        },
    });
    if (processing.count === 0) {
        const latest = yield prisma_1.prisma.email.findUnique({
            where: {
                id: email.id,
            },
        });
        if ((latest === null || latest === void 0 ? void 0 : latest.status) === "SENT") {
            console.log(`Email ${email.id} was already sent.`);
            return {
                success: true,
                skipped: true,
                emailId: email.id,
            };
        }
        throw new Error(`Email ${email.id} could not enter processing state`);
    }
    // ------------------------------------
    // 6. Send email
    // ------------------------------------
    try {
        const result = yield (0, mailer_1.sendEmail)(email.sender, email.to, email.subject, email.body);
        // ------------------------------------
        // 7. Mark SENT
        // ------------------------------------
        const sentEmail = yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                status: "SENT",
                sentAt: new Date(),
                processingStartedAt: null,
                error: null,
            },
            include: {
                sender: true,
            },
        });
        yield (0, email_search_service_1.indexEmail)(sentEmail);
        console.log(`Email ${email.id} sent successfully`);
        return {
            success: true,
            emailId: email.id,
            messageId: result.messageId,
        };
    }
    catch (error) {
        // ------------------------------------
        // 8. Mark FAILED
        // ------------------------------------
        const message = error instanceof Error
            ? error.message
            : "Unknown email error";
        const failedEmail = yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                status: "FAILED",
                processingStartedAt: null,
                error: message,
            },
            include: {
                sender: true,
            },
        });
        yield (0, email_search_service_1.indexEmail)(failedEmail);
        console.error(`Email ${email.id} failed:`, message);
        throw error;
    }
}), workerOptions);
// ------------------------------------
// Worker events
// ------------------------------------
worker.on("ready", () => {
    console.log("BullMQ worker ready");
});
worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});
worker.on("failed", (job, error) => {
    console.error(`Job ${job === null || job === void 0 ? void 0 : job.id} failed:`, error.message);
});
worker.on("error", (error) => {
    console.error("Worker error:", error);
});
// ------------------------------------
// Redis events
// ------------------------------------
redis_1.redis.on("connect", () => {
    console.log("Redis connected");
});
redis_1.redis.on("ready", () => {
    console.log("Redis ready");
});
redis_1.redis.on("error", (error) => {
    console.error("Redis error:", error);
});
// ------------------------------------
// Startup
// ------------------------------------
console.log("Email worker started...");
console.log(`Concurrency: ${WORKER_CONCURRENCY}`);
// Run once on boot: reconcile any PROCESSING rows left behind
// by a previous crash whose BullMQ job is no longer live.
recoverStaleProcessingEmails();
// Run once on boot: reconcile any overdue SCHEDULED rows whose
// underlying BullMQ job is missing entirely (e.g. Redis was
// restarted/reconfigured since the job was created).
recoverOrphanedScheduledEmails();
// import "dotenv/config";
// import {
//   Worker,
//   WorkerOptions,
// } from "bullmq";
// import { redis } from "../lib/redis";
// import { prisma } from "../lib/prisma";
// import { sendGmailEmail } from "../lib/gmail";
// import { sendEmail } from "../lib/mailer";
// import { emailQueue } from "../queue/email.queue";
// import {
//   acquireHourlyLimit,
//   waitForMinimumDelay,
// } from "../services/rate-limiter";
// import { indexEmail } from "../services/email-search.service";
// const WORKER_CONCURRENCY = Number(
//   process.env.WORKER_CONCURRENCY || 5
// );
// const workerOptions: WorkerOptions = {
//   connection: redis,
//   concurrency: WORKER_CONCURRENCY,
//   lockDuration: 60000,
// };
// const worker = new Worker(
//   "email-queue",
//   async (job) => {
//     const emailId = Number(
//       job.data.emailId
//     );
//     console.log("--------------------------------");
//     console.log(
//       `Processing email ${emailId}`
//     );
//     console.log(`Job: ${job.id}`);
//     console.log("--------------------------------");
//     // ------------------------------------
//     // 1. Fetch email
//     // ------------------------------------
//     const email =
//       await prisma.email.findUnique({
//         where: {
//           id: emailId,
//         },
//         include: {
//           sender: true,
//         },
//       });
//     if (!email) {
//       throw new Error(
//         `Email ${emailId} not found`
//       );
//     }
//     // ------------------------------------
//     // 2. Idempotency
//     // ------------------------------------
//     if (email.status === "SENT") {
//       console.log(
//         `Email ${email.id} already sent. Skipping.`
//       );
//       return {
//         success: true,
//         skipped: true,
//         emailId: email.id,
//       };
//     }
//     // ------------------------------------
//     // 3. Hourly rate limit
//     // ------------------------------------
//     const rateLimit =
//       await acquireHourlyLimit(
//         email.senderId
//       );
//     if (!rateLimit.allowed) {
//       const retryAt = rateLimit.retryAt!;
//       const delay = Math.max(
//         retryAt.getTime() - Date.now(),
//         1000
//       );
//       console.log(
//         `Hourly limit reached for sender ${email.senderId}`
//       );
//       console.log(
//         `Rescheduling email ${email.id} for ${retryAt.toISOString()}`
//       );
//       await emailQueue.add(
//         "send-email",
//         {
//           emailId: email.id,
//         },
//         {
//           delay,
//           jobId: `email-${email.id}-retry-${retryAt.getTime()}`,
//         }
//       );
//       return {
//         success: false,
//         rateLimited: true,
//         emailId: email.id,
//         retryAt: retryAt.toISOString(),
//       };
//     }
//     await waitForMinimumDelay(
//       email.senderId
//     );
//     // ------------------------------------
//     // 5. Atomically mark PROCESSING
//     // ------------------------------------
//     const processing =
//       await prisma.email.updateMany({
//         where: {
//           id: email.id,
//           status: "SCHEDULED",
//         },
//         data: {
//           status: "PROCESSING",
//           attempts: {
//             increment: 1,
//           },
//         },
//       });
//     if (processing.count === 0) {
//       const latest =
//         await prisma.email.findUnique({
//           where: {
//             id: email.id,
//           },
//         });
//       if (latest?.status === "SENT") {
//         console.log(
//           `Email ${email.id} was already sent.`
//         );
//         return {
//           success: true,
//           skipped: true,
//           emailId: email.id,
//         };
//       }
//       if (
//         latest?.status ===
//         "PROCESSING"
//       ) {
//         console.log(
//           `Email ${email.id} is already processing.`
//         );
//         return {
//           success: true,
//           skipped: true,
//           emailId: email.id,
//         };
//       }
//       throw new Error(
//         `Email ${email.id} could not enter processing state`
//       );
//     }
//     // ------------------------------------
//     // 6. Send email
//     // ------------------------------------
//     try {
//       const result = await sendEmail(
//         email.sender,
//         email.to,
//         email.subject,
//         email.body
//       );
//       // ------------------------------------
//       // 7. Mark SENT
//       // ------------------------------------
//       const sentEmail = await prisma.email.update({
//         where: {
//           id: email.id,
//         },
//         data: {
//           status: "SENT",
//           sentAt: new Date(),
//           error: null,
//         },
//       });
//       await indexEmail(sentEmail);
//       console.log(
//         `Email ${email.id} sent successfully`
//       );
//       return {
//         success: true,
//         emailId: email.id,
//         messageId: result.messageId,
//       };
//     } catch (error) {
//       // ------------------------------------
//       // 8. Mark FAILED
//       // ------------------------------------
//       const message =
//         error instanceof Error
//           ? error.message
//           : "Unknown email error";
//       const failedEmail = await prisma.email.update({
//         where: {
//           id: email.id,
//         },
//         data: {
//           status: "FAILED",
//           error: message,
//         },
//       });
//       await indexEmail(failedEmail);
//       console.error(
//         `Email ${email.id} failed:`,
//         message
//       );
//       throw error;
//     }
//   },
//   workerOptions
// );
// // ------------------------------------
// // Worker events
// // ------------------------------------
// worker.on("ready", () => {
//   console.log(
//     "BullMQ worker ready"
//   );
// });
// worker.on("completed", (job) => {
//   console.log(
//     `Job ${job.id} completed`
//   );
// });
// worker.on("failed", (job, error) => {
//   console.error(
//     `Job ${job?.id} failed:`,
//     error.message
//   );
// });
// worker.on("error", (error) => {
//   console.error(
//     "Worker error:",
//     error
//   );
// });
// // ------------------------------------
// // Redis events
// // ------------------------------------
// redis.on("connect", () => {
//   console.log(
//     "Redis connected"
//   );
// });
// redis.on("ready", () => {
//   console.log(
//     "Redis ready"
//   );
// });
// redis.on("error", (error) => {
//   console.error(
//     "Redis error:",
//     error
//   );
// });
// // ------------------------------------
// // Startup
// // ------------------------------------
// console.log(
//   "Email worker started..."
// );
// console.log(
//   `Concurrency: ${WORKER_CONCURRENCY}`
// );
