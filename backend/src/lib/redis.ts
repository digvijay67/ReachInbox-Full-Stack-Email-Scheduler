import IORedis from "ioredis";

export const redis = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6380),

  maxRetriesPerRequest: null,

  enableReadyCheck: true,

  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

redis.on("connect", () => {
  console.log("Redis connecting...");
});

redis.on("ready", () => {
  console.log("Redis ready");
});

redis.on("error", (error) => {
  console.error("Redis error:", error);
});