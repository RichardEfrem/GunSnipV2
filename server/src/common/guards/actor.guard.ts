import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';

/**
 * Resolves who is making the request (PRD §11.1) and puts it on the request as an `Actor`.
 *
 * Phase 0 reads the `gs_session` cookie and mints one when absent, always returning the guest
 * arm. Phase 1 adds: read the auth cookie, and return `{ kind: 'user', ... }` when it is valid.
 * That is the whole change — no service signature, table or route moves, because nothing
 * downstream has ever seen a `userId` parameter.
 *
 * Registered globally, so every request has an actor and no endpoint can forget to ask.
 */
@Injectable()
export class ActorGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    request.actor = this.resolve(request, http.getResponse<Response>());
    return true;
  }

  private resolve(request: Request, response: Response): Actor {
    return { kind: 'guest', sessionId: this.readOrMintSessionId(request, response) };
  }

  /**
   * The web app's proxy normally mints this cookie so the browser has it on first paint; this
   * covers direct API calls, and is what keeps the API usable without the web app in front.
   */
  private readOrMintSessionId(request: Request, response: Response): string {
    const existing = request.cookies?.[this.config.sessionCookieName] as unknown;

    if (typeof existing === 'string' && isUuid(existing)) {
      return existing;
    }

    const sessionId = randomUUID();

    response.cookie(this.config.sessionCookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      maxAge: this.config.sessionCookieMaxAgeMs,
      path: '/',
    });

    return sessionId;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}
