import { All, Controller, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotFoundError } from '../errors/not-found.error.js';

/**
 * Catches anything under the API prefix that matched no route.
 *
 * Without this, Express answers with an HTML error page that no API client can parse, and the
 * exception filter never runs — so a typo'd URL would be the one response shape the web app
 * does not understand. Registered last so it only sees what nothing else claimed.
 */
@Controller()
export class FallbackController {
  @All('*splat')
  notFound(@Req() request: Request): never {
    throw new NotFoundError(`No route matches ${request.method} ${request.originalUrl}.`);
  }
}
