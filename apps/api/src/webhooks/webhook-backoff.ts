/**
 * Retry schedule and dead-letter policy for the webhook delivery queue.
 *
 * Delivery attempts back off exponentially from a base delay, capped so a permanently unreachable
 * endpoint is retried at a bounded cadence rather than ever more slowly. Once the attempt budget is
 * exhausted the delivery is moved to the terminal DEAD state (dead-letter) and no longer retried.
 */

/** Maximum number of attempts before a delivery is dead-lettered. */
export const WEBHOOK_MAX_ATTEMPTS = 8;

/** Delay applied after the first failed attempt. */
export const WEBHOOK_BASE_DELAY_MS = 30_000;

/** Upper bound on any single backoff interval (6 hours). */
export const WEBHOOK_MAX_DELAY_MS = 6 * 60 * 60 * 1000;

/**
 * The backoff delay to apply after `attemptCount` attempts have been made (>= 1). The first retry
 * waits {@link WEBHOOK_BASE_DELAY_MS}; each subsequent retry doubles it up to
 * {@link WEBHOOK_MAX_DELAY_MS}.
 */
export function backoffDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  // Cap the exponent before shifting to avoid overflow on pathological inputs.
  const uncapped = exponent >= 40 ? WEBHOOK_MAX_DELAY_MS : WEBHOOK_BASE_DELAY_MS * 2 ** exponent;
  return Math.min(WEBHOOK_MAX_DELAY_MS, uncapped);
}

/** The wall-clock time of the next attempt, given the attempts made so far. */
export function nextAttemptAt(attemptCount: number, now: Date): Date {
  return new Date(now.getTime() + backoffDelayMs(attemptCount));
}

/** Whether the attempt budget is exhausted and the delivery must be dead-lettered. */
export function hasReachedMaxAttempts(attemptCount: number): boolean {
  return attemptCount >= WEBHOOK_MAX_ATTEMPTS;
}
