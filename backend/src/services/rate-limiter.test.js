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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const redis_1 = require("../lib/redis");
const rate_limiter_1 = require("./rate-limiter");
function getHourKey(senderId) {
    const now = new Date();
    const istNow = new Date(now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    }));
    return [
        istNow.getFullYear(),
        String(istNow.getMonth() + 1).padStart(2, "0"),
        String(istNow.getDate()).padStart(2, "0"),
        String(istNow.getHours()).padStart(2, "0"),
    ].join("-");
}
(0, node_test_1.describe)("rate limiter", () => {
    (0, node_test_1.it)("reserves a slot when a send is allowed and releases it on failure", () => __awaiter(void 0, void 0, void 0, function* () {
        const senderId = 98765;
        const key = `email-rate:${senderId}:${getHourKey(senderId)}`;
        yield redis_1.redis.del(key);
        const first = yield (0, rate_limiter_1.acquireHourlyLimit)(senderId);
        strict_1.default.equal(first.allowed, true);
        strict_1.default.equal(Number((yield redis_1.redis.get(key)) || "0"), 1);
        const released = yield (0, rate_limiter_1.releaseHourlyLimit)(senderId);
        strict_1.default.equal(released, 0);
        strict_1.default.equal(Number((yield redis_1.redis.get(key)) || "0"), 0);
    }));
    (0, node_test_1.it)("does not let scheduled jobs inflate the sender quota", () => __awaiter(void 0, void 0, void 0, function* () {
        const senderId = 98766;
        const key = `email-rate:${senderId}:${getHourKey(senderId)}`;
        yield redis_1.redis.del(key);
        const max = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || process.env.MAX_EMAILS_PER_HOUR || 200);
        for (let i = 0; i < max; i++) {
            const result = yield (0, rate_limiter_1.acquireHourlyLimit)(senderId);
            if (!result.allowed) {
                throw new Error("Should still allow the first max sends");
            }
        }
        const blocked = yield (0, rate_limiter_1.acquireHourlyLimit)(senderId);
        strict_1.default.equal(blocked.allowed, false);
        strict_1.default.equal(Number((yield redis_1.redis.get(key)) || "0"), max);
        yield redis_1.redis.del(key);
    }));
});
