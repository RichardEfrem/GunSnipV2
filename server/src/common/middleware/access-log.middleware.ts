import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One structured line per completed request (PRD §12 Observability). Logged on `finish` so the
 * status is the one actually sent, including statuses set by the exception filter.
 */
@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.logger.log({
        requestId: request.requestId,
        method: request.method,
        path: redactQuery(request.originalUrl),
        status: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });

    next();
  }
}

/** Query parameters whose values are personal data and never belong in a log line. */
const REDACTED_PARAMS = new Set(['email']);

/**
 * `/orders/GS-260907-4471?email=amuro@example.com` → `…?email=%5Bredacted%5D`. Guest order lookup
 * carries the email in the query string (PRD §10, FR-ORD-02); the log keeps that a lookup
 * happened without keeping whose.
 */
export function redactQuery(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;

  const params = new URLSearchParams(url.slice(queryStart + 1));
  let isRedacted = false;

  for (const name of REDACTED_PARAMS) {
    if (params.has(name)) {
      params.set(name, '[redacted]');
      isRedacted = true;
    }
  }

  return isRedacted ? `${url.slice(0, queryStart)}?${params.toString()}` : url;
}
