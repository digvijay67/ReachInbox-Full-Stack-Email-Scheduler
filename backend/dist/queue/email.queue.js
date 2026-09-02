"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const MAX_JOB_ATTEMPTS = Number(process.env.MAX_JOB_ATTEMPTS || 5);
exports.emailQueue = new bullmq_1.Queue("email-queue", {
    connection: redis_1.redis,
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
});
