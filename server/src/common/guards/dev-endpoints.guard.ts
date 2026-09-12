import { type CanActivate, Injectable } from '@nestjs/common';
import { NotFoundError } from '../errors/not-found.error.js';
import { AppConfig } from '../../config/app-config.js';

/**
 * Gates the endpoints that only exist while developing (FR-PAY-05).
 *
 * Refuses with 404 rather than 403: a production deployment should not admit that a route which
 * settles payments for free exists at all. The flag is `ENABLE_DEV_ENDPOINTS`, which defaults to
 * false, so leaving it out of an environment closes these rather than opening them.
 */
@Injectable()
export class DevEndpointsGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(): boolean {
    if (!this.config.areDevEndpointsEnabled) {
      throw new NotFoundError('Cannot GET or POST that path.');
    }

    return true;
  }
}
