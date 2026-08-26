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
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 5);
const workerOptions = {
    connection: redis_1.redis,
    concurrency: WORKER_CONCURRENCY,
    lockDuration: 60000,
};
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
    // 3. Hourly rate limit
    // ------------------------------------
    const rateLimit = yield (0, rate_limiter_1.acquireHourlyLimit)(email.senderId);
    if (!rateLimit.allowed) {
        const retryAt = rateLimit.retryAt;
        const delay = Math.max(retryAt.getTime() - Date.now(), 1000);
        console.log(`Hourly limit reached for sender ${email.senderId}`);
        console.log(`Rescheduling email ${email.id} for ${retryAt.toISOString()}`);
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
    yield (0, rate_limiter_1.waitForMinimumDelay)(email.senderId);
    // ------------------------------------
    // 5. Atomically mark PROCESSING
    // ------------------------------------
    const processing = yield prisma_1.prisma.email.updateMany({
        where: {
            id: email.id,
            status: "SCHEDULED",
        },
        data: {
            status: "PROCESSING",
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
        if ((latest === null || latest === void 0 ? void 0 : latest.status) ===
            "PROCESSING") {
            console.log(`Email ${email.id} is already processing.`);
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
        yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                status: "SENT",
                sentAt: new Date(),
                error: null,
            },
        });
        console.log(`Email ${email.id} sent successfully`);
        return {
            success: true,
            emailId: email.id,
            messageId: result.messageId,
            previewUrl: result.previewUrl,
        };
    }
    catch (error) {
        // ------------------------------------
        // 8. Mark FAILED
        // ------------------------------------
        const message = error instanceof Error
            ? error.message
            : "Unknown email error";
        yield prisma_1.prisma.email.update({
            where: {
                id: email.id,
            },
            data: {
                status: "FAILED",
                error: message,
            },
        });
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
