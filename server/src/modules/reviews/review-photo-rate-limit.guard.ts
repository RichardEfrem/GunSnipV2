import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TooManyRequestsError } from '../../common/errors/too-many-requests.error.js';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';

/**
 * Caps how fast one caller can upload review photos (PRD §12 Security).
 *
 * The token already limits *who* can upload; this limits how much. A review carries at most six
 * photos, and a customer retrying a few that failed is still well inside thirty in ten minutes —
 * a script re-uploading against one link to fill the disk is not.
 *
 * It runs as a guard, before the file interceptor, so a refused request is turned away before
 * its body is buffered or decoded. Bucketed by address for the reason the order limiter gives:
 * a session cookie is something the caller can simply discard.
 */
const POLICY = { limit: 30, windowMs: 10 * 60 * 1000 };

@Injectable()
export class ReviewPhotoRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    const verdict = this.limiter.hit(`reviews.photos:${request.ip ?? request.actor?.sessionId ?? 'unknown'}`, POLICY);

    if (!verdict.isAllowed) {
      http.getResponse<Response>().setHeader('Retry-After', verdict.retryAfterSeconds);

      throw new TooManyRequestsError(
        'Too many photo uploads from this connection. Wait a moment and try again.',
        verdict.retryAfterSeconds,
      );
    }

    return true;
  }
}
