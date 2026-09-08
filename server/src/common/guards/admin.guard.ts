import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

const ADMIN_KEY_HEADER = 'x-admin-key';

/**
 * Guards every admin route from day one (PRD §11.2).
 *
 * Phase 0 compares a shared secret. Phase 1 replaces the *body* of this method with a role
 * check on `actor.roles` — every `@UseGuards(AdminGuard)`, every test and every admin screen
 * stays exactly as written. The guard's presence is the point; the strength of the Phase 0
 * secret is not.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.header(ADMIN_KEY_HEADER);

    if (!presented || !matches(presented, this.config.adminKey)) {
      throw new UnauthorizedError('Admin credentials are missing or invalid.');
    }

    return true;
  }
}

/** Constant-time so a wrong key cannot be discovered one character at a time. */
function matches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return a.length === b.length && timingSafeEqual(a, b);
}
