/**
 * Retry helper for calls from web to API.
 *
 * Web and API are separate Render services that sleep independently, so "web is awake, API is
 * still booting" is a routine state, not an exceptional one. During spin-up Render's edge answers
 * with 502/503/504 or refuses the connection outright; without a retry the server component throws
 * and the visitor gets a 500 page for what is really a slow start.
 */

/** Backoff before each retry, in milliseconds. Total patience ≈ 47s, covering a typical boot. */
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 15_000, 15_000];

/** Upstream statuses that mean the origin never processed the request. */
const SPIN_UP_STATUSES = new Set([502, 503, 504]);

/**
 * Methods that are safe to replay for any spin-up signal. Anything else is only replayed on a
 * signal that guarantees the request never reached the application, so a quotation or invoice
 * cannot be submitted twice.
 */
const REPLAYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

/**
 * A 503 is Render's own spin-up response, emitted before the container accepts traffic, so it is
 * safe to replay for any method. A 502/504 can mean the origin was reached and timed out midway,
 * so those are only replayed for read-only methods.
 */
function shouldRetryStatus(status: number, method: string): boolean {
  if (!SPIN_UP_STATUSES.has(status)) {
    return false;
  }
  return REPLAYABLE_METHODS.has(method) || status === 503;
}

/**
 * A thrown fetch means no response was received. For read-only methods that is always safe to
 * replay. For mutations it is not provably safe, but a connection that was refused or reset during
 * a known spin-up window is far more likely to be "never delivered" than "delivered and lost", so
 * it is replayed once only.
 */
function retriesForThrownFetch(method: string): number {
  return REPLAYABLE_METHODS.has(method) ? RETRY_DELAYS_MS.length : 1;
}

/**
 * Run a fetch, retrying through a Render cold start.
 *
 * @param request Performs the call. Invoked once per attempt.
 * @param init Used only to read the HTTP method for replay-safety decisions.
 */
export async function fetchThroughColdStart(
  request: () => Promise<Response>,
  init?: RequestInit,
): Promise<Response> {
  const method = methodOf(init);
  const throwRetryBudget = retriesForThrownFetch(method);
  let thrownAttempts = 0;

  for (let attempt = 0; ; attempt += 1) {
    const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;

    try {
      const response = await request();
      if (isLastAttempt || !shouldRetryStatus(response.status, method)) {
        return response;
      }
    } catch (error) {
      thrownAttempts += 1;
      if (isLastAttempt || thrownAttempts > throwRetryBudget) {
        throw error;
      }
    }

    await delay(RETRY_DELAYS_MS[attempt] ?? 0);
  }
}
