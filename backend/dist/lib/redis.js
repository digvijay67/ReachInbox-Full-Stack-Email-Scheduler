"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
        return Math.min(times * 500, 5000);
    },
};
exports.redis = process.env.REDIS_URL
    ? new ioredis_1.default(process.env.REDIS_URL, redisOptions)
    : new ioredis_1.default(Object.assign({ host: process.env.REDIS_HOST || "localhost", port: Number(process.env.REDIS_PORT || 6380) }, redisOptions));
exports.redis.on("connect", () => {
    console.log("Redis connecting...");
});
exports.redis.on("ready", () => {
    console.log("Redis ready");
});
exports.redis.on("error", (error) => {
    console.error("Redis error:", error);
});
