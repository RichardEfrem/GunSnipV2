import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { TooManyRequestsError } from '../../common/errors/too-many-requests.error.js';
import { AppConfig } from '../../config/app-config.js';

/**
 * Caps how fast one caller can place orders (PRD §12 Security).
 *
 * This is not the double-click guard — `Idempotency-Key` is (FR-CO-07), and it runs after this
 * one. This is the loop guard: every `POST /orders` that succeeds reserves stock, so a script
 * left running can empty the catalogue's availability without paying for a single kit. The limit
 * is a ceiling on how much of that anyone can do before somebody notices.
 *
 * Bucketed by IP, not by session. A session id is a cookie the caller holds, so a script that
 * clears it between requests gets a fresh allowance every time and the limit means nothing; an
 * address is the cheapest thing about a request that the caller cannot simply re-roll. The cost
 * is that people sharing one address share one allowance — at ten orders in five minutes, a
 * cost nobody real pays.
 *
 * Attempts are counted, not orders. A request refused for a stale total or an empty cart still
 * spends from the allowance, because the work it made the server do is the same.
 */
@Injectable()
export class OrderRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    const verdict = this.limiter.hit(bucketFor(request), {
      limit: this.config.orderRateLimit,
      windowMs: this.config.orderRateWindowMs,
    });

    if (!verdict.isAllowed) {
      http.getResponse<Response>().setHeader('Retry-After', verdict.retryAfterSeconds);

      throw new TooManyRequestsError(
        'Too many checkout attempts from this connection. Wait a moment and try again.',
        verdict.retryAfterSeconds,
      );
    }

    return true;
  }
}

/**
 * Scoped by name so this endpoint's allowance is its own, and never shared with whatever else is
 * rate limited later.
 *
 * `request.ip` is only as trustworthy as `TRUST_PROXY_HOPS` says it is (see `bootstrap.ts`). It
 * is undefined on a socket that has already gone away, which is not a request worth serving; the
 * session id then keeps those in a bucket of their own rather than in everyone else's.
 */
function bucketFor(request: Request): string {
  return `orders.create:${request.ip ?? request.actor?.sessionId ?? 'unknown'}`;
}
