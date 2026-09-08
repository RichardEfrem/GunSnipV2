import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Anything longer or stranger than this is ignored and replaced — it ends up in log files. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Gives every request an id and echoes it back, so a log line, an error response and a
 * support question can be tied together (PRD §12 Observability).
 *
 * This is middleware rather than an interceptor because guards run *before* interceptors —
 * a 401 from AdminGuard still needs to carry its request id.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header('x-request-id');
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
