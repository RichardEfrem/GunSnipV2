import { Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter.js';

/**
 * The shared counter store. A module imports this to guard one of its routes; the policy — which
 * route, how many, how often, and what the caller is bucketed by — stays with that module.
 */
@Module({
  providers: [RateLimiter],
  exports: [RateLimiter],
})
export class RateLimitModule {}
