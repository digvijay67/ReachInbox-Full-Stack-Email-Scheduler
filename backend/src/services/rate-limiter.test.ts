import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { redis } from "../lib/redis";
import {
  acquireHourlyLimit,
  releaseHourlyLimit,
} from "./rate-limiter";

function getHourKey(senderId: number) {
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    })
  );

  return [
    istNow.getFullYear(),
    String(istNow.getMonth() + 1).padStart(2, "0"),
    String(istNow.getDate()).padStart(2, "0"),
    String(istNow.getHours()).padStart(2, "0"),
  ].join("-");
}

describe("rate limiter", () => {
  it("reserves a slot when a send is allowed and releases it on failure", async () => {
    const senderId = 98765;
    const key = `email-rate:${senderId}:${getHourKey(senderId)}`;

    await redis.del(key);

    const first = await acquireHourlyLimit(senderId);
    assert.equal(first.allowed, true);
    assert.equal(Number(await redis.get(key) || "0"), 1);

    const released = await releaseHourlyLimit(senderId);
    assert.equal(released, 0);
    assert.equal(Number(await redis.get(key) || "0"), 0);
  });

  it("does not let scheduled jobs inflate the sender quota", async () => {
    const senderId = 98766;
    const key = `email-rate:${senderId}:${getHourKey(senderId)}`;

    await redis.del(key);

    const max = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || process.env.MAX_EMAILS_PER_HOUR || 200);

    for (let i = 0; i < max; i++) {
      const result = await acquireHourlyLimit(senderId);
      if (!result.allowed) {
        throw new Error("Should still allow the first max sends");
      }
    }

    const blocked = await acquireHourlyLimit(senderId);
    assert.equal(blocked.allowed, false);
    assert.equal(Number(await redis.get(key) || "0"), max);

    await redis.del(key);
  });
});
