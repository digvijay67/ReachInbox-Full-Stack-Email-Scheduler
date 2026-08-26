import "dotenv/config";

import {
  Worker,
  WorkerOptions,
} from "bullmq";

import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendGmailEmail } from "../lib/gmail";
import { sendEmail } from "../lib/mailer";
import { emailQueue } from "../queue/email.queue";
import {
  acquireHourlyLimit,
  waitForMinimumDelay,
} from "../services/rate-limiter";

const WORKER_CONCURRENCY = Number(
  process.env.WORKER_CONCURRENCY || 5
);

const workerOptions: WorkerOptions = {
  connection: redis,

  concurrency: WORKER_CONCURRENCY,

  lockDuration: 60000,
};

const worker = new Worker(
  "email-queue",

  async (job) => {
    const emailId = Number(
      job.data.emailId
    );

    console.log("--------------------------------");
    console.log(
      `Processing email ${emailId}`
    );
    console.log(`Job: ${job.id}`);
    console.log("--------------------------------");

    // ------------------------------------
    // 1. Fetch email
    // ------------------------------------

    const email =
      await prisma.email.findUnique({
        where: {
          id: emailId,
        },

        include: {
          sender: true,
        },
      });

    if (!email) {
      throw new Error(
        `Email ${emailId} not found`
      );
    }

    // ------------------------------------
    // 2. Idempotency
    // ------------------------------------

    if (email.status === "SENT") {
      console.log(
        `Email ${email.id} already sent. Skipping.`
      );

      return {
        success: true,
        skipped: true,
        emailId: email.id,
      };
    }

    // ------------------------------------
    // 3. Hourly rate limit
    // ------------------------------------

    const rateLimit =
      await acquireHourlyLimit(
        email.senderId
      );



    if (!rateLimit.allowed) {
      const retryAt = rateLimit.retryAt!;

      const delay = Math.max(
        retryAt.getTime() - Date.now(),
        1000
      );

      console.log(
        `Hourly limit reached for sender ${email.senderId}`
      );

      console.log(
        `Rescheduling email ${email.id} for ${retryAt.toISOString()}`
      );

      await emailQueue.add(
        "send-email",
        {
          emailId: email.id,
        },
        {
          delay,
          jobId: `email-${email.id}-retry-${retryAt.getTime()}`,
        }
      );

      return {
        success: false,
        rateLimited: true,
        emailId: email.id,
        retryAt: retryAt.toISOString(),
      };
    }
    await waitForMinimumDelay(
      email.senderId
    );

    // ------------------------------------
    // 5. Atomically mark PROCESSING
    // ------------------------------------

    const processing =
      await prisma.email.updateMany({
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
      const latest =
        await prisma.email.findUnique({
          where: {
            id: email.id,
          },
        });

      if (latest?.status === "SENT") {
        console.log(
          `Email ${email.id} was already sent.`
        );

        return {
          success: true,
          skipped: true,
          emailId: email.id,
        };
      }

      if (
        latest?.status ===
        "PROCESSING"
      ) {
        console.log(
          `Email ${email.id} is already processing.`
        );

        return {
          success: true,
          skipped: true,
          emailId: email.id,
        };
      }

      throw new Error(
        `Email ${email.id} could not enter processing state`
      );
    }

    // ------------------------------------
    // 6. Send email
    // ------------------------------------

    try {
      const result = await sendEmail(
        email.sender,
        email.to,
        email.subject,
        email.body
      );

      // ------------------------------------
      // 7. Mark SENT
      // ------------------------------------

      await prisma.email.update({
        where: {
          id: email.id,
        },

        data: {
          status: "SENT",

          sentAt: new Date(),

          error: null,
        },
      });

      console.log(
        `Email ${email.id} sent successfully`
      );

      return {
        success: true,

        emailId: email.id,

        messageId: result.messageId,
      };
    } catch (error) {
      // ------------------------------------
      // 8. Mark FAILED
      // ------------------------------------

      const message =
        error instanceof Error
          ? error.message
          : "Unknown email error";

      await prisma.email.update({
        where: {
          id: email.id,
        },

        data: {
          status: "FAILED",

          error: message,
        },
      });

      console.error(
        `Email ${email.id} failed:`,
        message
      );

      throw error;
    }
  },

  workerOptions
);

// ------------------------------------
// Worker events
// ------------------------------------

worker.on("ready", () => {
  console.log(
    "BullMQ worker ready"
  );
});

worker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed`
  );
});

worker.on("failed", (job, error) => {
  console.error(
    `Job ${job?.id} failed:`,
    error.message
  );
});

worker.on("error", (error) => {
  console.error(
    "Worker error:",
    error
  );
});

// ------------------------------------
// Redis events
// ------------------------------------

redis.on("connect", () => {
  console.log(
    "Redis connected"
  );
});

redis.on("ready", () => {
  console.log(
    "Redis ready"
  );
});

redis.on("error", (error) => {
  console.error(
    "Redis error:",
    error
  );
});

// ------------------------------------
// Startup
// ------------------------------------

console.log(
  "Email worker started..."
);

console.log(
  `Concurrency: ${WORKER_CONCURRENCY}`
);