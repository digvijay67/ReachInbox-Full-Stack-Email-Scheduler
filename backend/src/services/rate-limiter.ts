import { redis } from "../lib/redis";

const MAX_EMAILS_PER_HOUR = Number(
  process.env.MAX_EMAILS_PER_HOUR || 200
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
export async function acquireHourlyLimit(
  senderId: number
) {
  const now = new Date();

  const hourKey = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
  ].join("-");

  const key = `email-rate:${senderId}:${hourKey}`;

  const count = await redis.incr(key);

  if (count === 1) {
    // Keep the counter slightly longer than one hour.
    await redis.expire(key, 3700);
  }

  // Limit exceeded.
  if (count > MAX_EMAILS_PER_HOUR) {
    // We did not actually send this email,
    // therefore remove the increment.
    await redis.decr(key);

    const retryAt = getNextHour();

    return {
      allowed: false,
      retryAt,
    };
  }

  return {
    allowed: true,
    retryAt: null,
  };
}

/**
 * Makes sure emails from the same sender
 * have at least MIN_DELAY_MS between them.
 *
 * Redis is used so multiple workers share
 * the same sender timing.
 */
export async function waitForMinimumDelay(
  senderId: number
) {
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

  const waitTime = nextSend - now;

  if (waitTime > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitTime);
    });
  }
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
  const nextHour = new Date();

  nextHour.setUTCMinutes(0);
  nextHour.setUTCSeconds(0);
  nextHour.setUTCMilliseconds(0);

  nextHour.setUTCHours(
    nextHour.getUTCHours() + 1
  );

  return nextHour;
}