import { Queue } from "bullmq";

import { redis } from "../lib/redis";

const MAX_JOB_ATTEMPTS = Number(
  process.env.MAX_JOB_ATTEMPTS || 5
);

export const emailQueue = new Queue(
  "email-queue",
  {
    connection: redis,

    defaultJobOptions: {
      attempts: MAX_JOB_ATTEMPTS,

      backoff: {
        type: "fixed",
        delay: 60 * 1000,
      },

      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 10000,
      },

      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 10000,
      },
    },
  }
);