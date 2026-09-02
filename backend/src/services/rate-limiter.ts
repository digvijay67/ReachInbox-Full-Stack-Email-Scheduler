import { redis } from "../lib/redis";

const MAX_EMAILS_PER_HOUR = Number(
  process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ||
    process.env.MAX_EMAILS_PER_HOUR ||
    200
);

const MIN_DELAY_MS = Number(
  process.env.MIN_DELAY_MS || 2000
);

/**
 * Checks whether a sender can send another email
 * in the current UTC hour.
 *
 * Rate limit is stored in Redis, so it works
 * across multiple workers / server instances.
 */
function getHourlyLimitKey(
  senderId: number,
  now: Date = new Date()
) {
  const istNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    })
  );

  const hourKey = [
    istNow.getFullYear(),
    String(istNow.getMonth() + 1).padStart(2, "0"),
    String(istNow.getDate()).padStart(2, "0"),
    String(istNow.getHours()).padStart(2, "0"),
  ].join("-");

  return `email-rate:${senderId}:${hourKey}`;
}

export async function acquireHourlyLimit(
  senderId: number
) {
  const key = getHourlyLimitKey(senderId);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3700);
  }

  if (count > MAX_EMAILS_PER_HOUR) {
    await redis.decr(key);

    return {
      allowed: false,
      retryAt: getNextHour(),
    };
  }

  return {
    allowed: true,
    retryAt: null,
  };
}

export async function releaseHourlyLimit(
  senderId: number
) {
  const key = getHourlyLimitKey(senderId);

  const value = await redis.decr(key);

  if (value < 0) {
    await redis.set(key, "0");
  }

  return value;
}

export function isRateLimitError(
  message: string
) {
  return /429|rate limit|all recipients were rejected/i.test(
    message
  );
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

export type SendSlot = {
  /** How long the caller should actually wait, in ms. */
  waitMs: number;

  /** The absolute time this slot is reserved for. */
  nextSendAt: Date;

  /**
   * If true, the wait is too long to safely block inside the
   * current job's lock window. The caller should NOT sleep —
   * it should release this job and re-queue a fresh delayed
   * BullMQ job for `nextSendAt` instead.
   */
  shouldDefer: boolean;
};

/**
 * Atomically reserves the next allowed send time for a sender,
 * enforcing at least MIN_DELAY_MS between consecutive sends.
 *
 * Redis-backed (via a Lua script for atomicity) so this is safe
 * across multiple workers / server instances, exactly like the
 * hourly limiter above.
 */
export async function reserveSendSlot(
  senderId: number
): Promise<SendSlot> {
  const key = `email-next-send:${senderId}`;

  const now = Date.now();

  const result = await redis.eval(
    `
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
    `,
    1,
    key,
    now,
    MIN_DELAY_MS
  );

  const nextSend = Number(result);

  const waitMs = Math.max(nextSend - now, 0);

  return {
    waitMs,
    nextSendAt: new Date(nextSend),
    shouldDefer: waitMs > MAX_INLINE_WAIT_MS,
  };
}

/**
 * Blocks the current async call for `waitMs`.
 *
 * Only ever call this for SHORT waits (see MAX_INLINE_WAIT_MS
 * above / SendSlot.shouldDefer) — never for a wait long enough
 * to risk exceeding the BullMQ job's lock duration.
 */
export async function sleepForSendSlot(waitMs: number) {
  if (waitMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, waitMs);
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
export function getNextHour() {
  const now = new Date();

  const istNow = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    })
  );

  istNow.setMinutes(0);
  istNow.setSeconds(0);
  istNow.setMilliseconds(0);

  istNow.setHours(istNow.getHours() + 1);

  return istNow;
}