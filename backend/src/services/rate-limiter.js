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
exports.waitForMinimumDelay = waitForMinimumDelay;
exports.getNextHour = getNextHour;
const redis_1 = require("../lib/redis");
const MAX_EMAILS_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR || 200);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_MS || 2000);
/**
 * Checks whether a sender is allowed
 * to send another email in the current UTC hour.
 *
 * Important:
 * This function does NOT permanently increment
 * the counter when the limit is exceeded.
 */
function acquireHourlyLimit(senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const hourKey = [
            now.getUTCFullYear(),
            String(now.getUTCMonth() + 1).padStart(2, "0"),
            String(now.getUTCDate()).padStart(2, "0"),
            String(now.getUTCHours()).padStart(2, "0"),
        ].join("-");
        const key = `email-rate:${senderId}:${hourKey}`;
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
/**
 * Makes sure emails from the same sender
 * are separated by MIN_DELAY_MS.
 */
function waitForMinimumDelay(senderId) {
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
        const waitTime = nextSend - now;
        if (waitTime > 0) {
            yield new Promise((resolve) => {
                setTimeout(resolve, waitTime);
            });
        }
    });
}
/**
 * Returns the beginning of the next UTC hour.
 */
function getNextHour() {
    const nextHour = new Date();
    nextHour.setUTCMinutes(0);
    nextHour.setUTCSeconds(0);
    nextHour.setUTCMilliseconds(0);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1);
    return nextHour;
}
