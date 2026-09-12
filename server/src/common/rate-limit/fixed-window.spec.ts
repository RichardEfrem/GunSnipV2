import { describe, expect, it } from 'vitest';
import { hitWindow, type RateLimitPolicy, type RateLimitWindow } from './fixed-window.js';

/** Two requests a minute — small enough that every boundary is one call away. */
const POLICY: RateLimitPolicy = { limit: 2, windowMs: 60_000 };

const NOW = 1_700_000_000_000;

/** Runs `count` requests from one caller, all at `now`, and returns the last verdict. */
function burst(count: number, now: number = NOW, from?: RateLimitWindow) {
  let window = from;
  let verdict = hitWindow(window, now, POLICY);

  for (let i = 1; i < count; i += 1) {
    window = verdict.window;
    verdict = hitWindow(window, now, POLICY);
  }

  return verdict;
}

describe('hitWindow', () => {
  it('opens a window on the first request', () => {
    const verdict = hitWindow(undefined, NOW, POLICY);

    expect(verdict.isAllowed).toBe(true);
    expect(verdict.window).toEqual({ count: 1, resetAt: NOW + POLICY.windowMs });
  });

  it('allows exactly the limit inside one window', () => {
    expect(burst(POLICY.limit).isAllowed).toBe(true);
    expect(burst(POLICY.limit + 1).isAllowed).toBe(false);
  });

  it('leaves the window alone once it is refusing, so a flood cannot extend it', () => {
    const refused = burst(POLICY.limit + 5);

    expect(refused.window.count).toBe(POLICY.limit);
    expect(refused.window.resetAt).toBe(NOW + POLICY.windowMs);
  });

  it('reports the whole wait remaining, rounded up to a second', () => {
    const spent = burst(POLICY.limit).window;

    expect(hitWindow(spent, NOW + 500, POLICY).retryAfterSeconds).toBe(60);
    expect(hitWindow(spent, NOW + 58_200, POLICY).retryAfterSeconds).toBe(2);
  });

  it('never reports a wait of zero seconds while still refusing', () => {
    const spent = burst(POLICY.limit).window;

    // A millisecond before the reset: truthfully 0.001s, uselessly so as a `Retry-After`.
    expect(hitWindow(spent, spent.resetAt - 1, POLICY)).toMatchObject({
      isAllowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('opens a fresh window the instant the last one closes', () => {
    const spent = burst(POLICY.limit).window;
    const verdict = hitWindow(spent, spent.resetAt, POLICY);

    expect(verdict.isAllowed).toBe(true);
    expect(verdict.window).toEqual({ count: 1, resetAt: spent.resetAt + POLICY.windowMs });
  });

  it('counts a window that has been idle but not yet closed', () => {
    const first = hitWindow(undefined, NOW, POLICY);
    const second = hitWindow(first.window, NOW + 59_000, POLICY);

    expect(second.window.count).toBe(2);
    // The window still closes when it always was going to — being used does not extend it.
    expect(second.window.resetAt).toBe(NOW + POLICY.windowMs);
  });
});
