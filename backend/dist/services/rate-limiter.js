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
exports.acquireHourlyLimit = acquireHourlyLimit;
exports.releaseHourlyLimit = releaseHourlyLimit;
exports.isRateLimitError = isRateLimitError;
exports.reserveSendSlot = reserveSendSlot;
exports.sleepForSendSlot = sleepForSendSlot;
exports.getNextHour = getNextHour;
const redis_1 = require("../lib/redis");
const MAX_EMAILS_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ||
    process.env.MAX_EMAILS_PER_HOUR ||
    200);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS || 2000);
/**
 * Checks whether a sender can send another email
 * in the current UTC hour.
 *
 * Rate limit is stored in Redis, so it works
 * across multiple workers / server instances.
 */
function getHourlyLimitKey(senderId, now = new Date()) {
    const istNow = new Date(now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    }));
    const hourKey = [
        istNow.getFullYear(),
        String(istNow.getMonth() + 1).padStart(2, "0"),
        String(istNow.getDate()).padStart(2, "0"),
        String(istNow.getHours()).padStart(2, "0"),
    ].join("-");
    return `email-rate:${senderId}:${hourKey}`;
}
function acquireHourlyLimit(senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = getHourlyLimitKey(senderId);
        const count = yield redis_1.redis.incr(key);
        if (count === 1) {
            yield redis_1.redis.expire(key, 3700);
        }
        if (count > MAX_EMAILS_PER_HOUR) {
            yield redis_1.redis.decr(key);
            return {
                allowed: false,
                retryAt: getNextHour(),
            };
        }
        return {
            allowed: true,
            retryAt: null,
        };
    });
}
function releaseHourlyLimit(senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = getHourlyLimitKey(senderId);
        const value = yield redis_1.redis.decr(key);
        if (value < 0) {
            yield redis_1.redis.set(key, "0");
        }
        return value;
    });
}
function isRateLimitError(message) {
    return /429|rate limit|all recipients were rejected/i.test(message);
}
/**
 * Above this, we do NOT block inline inside the job.
 *
 * The BullMQ job lock (see workerOptions.lockDuration in
 * email.worker.ts, currently 60000ms) only protects a job for
 * so long. If many emails for the same sender become due at
 * once, sequential MIN_DELAY_MS spacing can push a job's wait
 * time past the lock duration while it's still legitimately
 * sleeping — not crashed. BullMQ would then treat it as stalled
 * and hand it to another worker, risking a duplicate send.
 *
 * Kept well under lockDuration (60000ms) so there's always
 * headroom even if the send itself takes a few seconds.
 */
const MAX_INLINE_WAIT_MS = 20000;
/**
 * Atomically reserves the next allowed send time for a sender,
 * enforcing at least MIN_DELAY_MS between consecutive sends.
 *
 * Redis-backed (via a Lua script for atomicity) so this is safe
 * across multiple workers / server instances, exactly like the
 * hourly limiter above.
 */
function reserveSendSlot(senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = `email-next-send:${senderId}`;
        const now = Date.now();
        const result = yield redis_1.redis.eval(`
    local current = redis.call("GET", KEYS[1])
    local now = tonumber(ARGV[1])
    local delay = tonumber(ARGV[2])

    local nextSend

    if not current then
      nextSend = now
    else
      nextSend = math.max(
        tonumber(current),
        now
      ) + delay
    end

    redis.call(
      "SET",
      KEYS[1],
      nextSend
    )

    return nextSend
    `, 1, key, now, MIN_DELAY_MS);
        const nextSend = Number(result);
        const waitMs = Math.max(nextSend - now, 0);
        return {
            waitMs,
            nextSendAt: new Date(nextSend),
            shouldDefer: waitMs > MAX_INLINE_WAIT_MS,
        };
    });
}
/**
 * Blocks the current async call for `waitMs`.
 *
 * Only ever call this for SHORT waits (see MAX_INLINE_WAIT_MS
 * above / SendSlot.shouldDefer) — never for a wait long enough
 * to risk exceeding the BullMQ job's lock duration.
 */
function sleepForSendSlot(waitMs) {
    return __awaiter(this, void 0, void 0, function* () {
        if (waitMs <= 0) {
            return;
        }
        yield new Promise((resolve) => {
            setTimeout(resolve, waitMs);
        });
    });
}
/**
 * Returns the beginning of the NEXT UTC hour.
 *
 * Example:
 *
 * Current UTC:
 * 2026-08-25 21:37
 *
 * Returns:
 * 2026-08-25 22:00:00 UTC
 *
 * This Date is correct for BullMQ/DB.
 */
function getNextHour() {
    const now = new Date();
    const istNow = new Date(now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    }));
    istNow.setMinutes(0);
    istNow.setSeconds(0);
    istNow.setMilliseconds(0);
    istNow.setHours(istNow.getHours() + 1);
    return istNow;
}
