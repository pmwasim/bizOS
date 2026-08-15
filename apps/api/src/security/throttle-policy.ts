export interface ThrottleLimit {
  limit: number;
  ttl: number;
}

export type ThrottlePolicy = Record<string, ThrottleLimit>;

/**
 * How far every throttle is widened for this process.
 *
 * The shipped limits are sized for one human on one connection. An end-to-end run drives the whole
 * product from a single source address, so it exhausts the same buckets a real user never
 * approaches — which produced 429s that looked like product failures rather than harness pressure.
 * `THROTTLE_SCALE` lets the harness declare its own headroom while production keeps the strict
 * numbers; `@bizo/config` rejects any value other than 1 when `NODE_ENV=production`.
 */
export function throttleScale(): number {
  // Read straight from the environment rather than through `readApiEnvironment`: these values are
  // needed while decorators evaluate at import time, which can precede a complete environment.
  // `@bizo/config` still validates the same variable on boot and refuses any value but 1 in
  // production — this is the fast path, not the authority.
  if (process.env.NODE_ENV === "production") {
    return 1;
  }

  const parsed = Number(process.env.THROTTLE_SCALE);
  // Anything unusable falls back to the strict limits. The only direction this knob moves is wider,
  // and only outside production.
  return Number.isFinite(parsed) && parsed > 1 ? Math.min(parsed, 1000) : 1;
}

export function scaledLimit(limit: number): number {
  return Math.max(limit, Math.ceil(limit * throttleScale()));
}

/** Apply {@link scaledLimit} across a named `@Throttle` policy, leaving every window untouched. */
export function scaledThrottle(policy: ThrottlePolicy): ThrottlePolicy {
  return Object.fromEntries(
    Object.entries(policy).map(([name, { limit, ttl }]) => [
      name,
      { limit: scaledLimit(limit), ttl },
    ]),
  );
}
