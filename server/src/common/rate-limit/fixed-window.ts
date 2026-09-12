/**
 * Fixed-window rate limiting, as a pure function over one caller's counter (PRD §12 Security).
 *
 * A window opens on the first request and closes `windowMs` later, whatever happens in between;
 * up to `limit` requests are allowed inside it. Fixed windows let a caller spend one window's
 * allowance at its end and the next at its start — a sliding window would not. That burst is
 * acceptable here: the limit exists to stop a script placing orders in a loop, and a script
 * doing so is stopped either way.
 *
 * Pure and separate from the store so the arithmetic can be tested without a clock or a Map,
 * the same split `stock-reservation.ts` makes.
 */
export interface RateLimitPolicy {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitWindow {
  count: number;
  /** Epoch milliseconds at which this window closes and the count starts again. */
  resetAt: number;
}

export interface RateLimitVerdict {
  isAllowed: boolean;
  /** What to put in `Retry-After`. Zero when allowed; never below 1 second when not. */
  retryAfterSeconds: number;
  /** The window to remember for this caller. Unchanged when the request was refused. */
  window: RateLimitWindow;
}

export function hitWindow(
  current: RateLimitWindow | undefined,
  now: number,
  policy: RateLimitPolicy,
): RateLimitVerdict {
  // No window, or the last one has closed: this request opens a fresh one.
  if (current === undefined || now >= current.resetAt) {
    return { isAllowed: true, retryAfterSeconds: 0, window: { count: 1, resetAt: now + policy.windowMs } };
  }

  // Refused. The count is left alone rather than incremented — a flood should not have to be
  // counted, and the window it would have to wait out is the same either way.
  if (current.count >= policy.limit) {
    return {
      isAllowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      window: current,
    };
  }

  return { isAllowed: true, retryAfterSeconds: 0, window: { ...current, count: current.count + 1 } };
}
