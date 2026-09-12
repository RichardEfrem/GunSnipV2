import { Injectable } from '@nestjs/common';
import { hitWindow, type RateLimitPolicy, type RateLimitVerdict, type RateLimitWindow } from './fixed-window.js';

/**
 * Counters for `hitWindow`, held in this process's memory.
 *
 * In-memory is the right size for one API instance and is the whole implementation: no client,
 * no connection to lose, nothing to fail closed on. It is also the limit of it — run two
 * instances behind a load balancer and each enforces the policy separately, so the effective
 * limit doubles. The seam for fixing that is this class: swapping the Map for Redis changes
 * `hit` and nothing that calls it, because the policy and the arithmetic live elsewhere.
 */

/**
 * Closed windows are dropped on the way past this many buckets, so a flood of one-request
 * callers cannot grow the Map without bound. High enough that a normal day never sweeps.
 */
const SWEEP_ABOVE_BUCKETS = 10_000;

@Injectable()
export class RateLimiter {
  private readonly windows = new Map<string, RateLimitWindow>();

  /** Records a request against `bucket` and says whether it is allowed. */
  hit(bucket: string, policy: RateLimitPolicy, now: number = Date.now()): RateLimitVerdict {
    const verdict = hitWindow(this.windows.get(bucket), now, policy);

    this.windows.set(bucket, verdict.window);
    if (this.windows.size > SWEEP_ABOVE_BUCKETS) this.sweep(now);

    return verdict;
  }

  private sweep(now: number): void {
    for (const [bucket, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(bucket);
    }
  }
}
