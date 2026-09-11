import { Injectable } from '@nestjs/common';
import { isUserActor, type Actor } from '@gunsnip/shared';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import type { CreateNotifyRequestDto } from './dto/create-notify-request.dto.js';
import type { NotifyRequestResult } from './entities/notify-request.entity.js';
import { NotifyRequestRepository } from './notify-request.repository.js';

/**
 * Back-in-stock capture (FR-PDP-12).
 *
 * The mail itself is Phase 10 — `FR-NOTIF-03` is a deferred Could and there is no `Mailer` yet
 * (PLAN.md). What matters now is that the *interest* is captured from the moment out-of-stock
 * pages exist, because a restock cannot retroactively learn who wanted to know.
 */
@Injectable()
export class NotifyRequestService {
  constructor(private readonly requests: NotifyRequestRepository) {}

  async register(actor: Actor, dto: CreateNotifyRequestDto): Promise<NotifyRequestResult> {
    if (!(await this.requests.isNotifiableVariant(dto.variantId))) {
      throw new NotFoundError('That item is no longer available.', { variantId: dto.variantId });
    }

    await this.requests.register({
      variantId: dto.variantId,
      email: this.normalise(dto.email),
      // Both, from the first migration (PRD §11.1). Phase 1 sets the user id without moving a row.
      sessionId: actor.sessionId,
      userId: isUserActor(actor) ? actor.userId : null,
    });

    return { variantId: dto.variantId, isRegistered: true };
  }

  /**
   * Lower-cased and trimmed before it reaches the unique index, so `Ada@example.com` and
   * `ada@example.com` are one subscriber rather than two mails about the same restock.
   *
   * Only the case is normalised. Stripping dots or `+tags` would be this store deciding it
   * knows a mail provider's routing rules better than the provider does.
   */
  private normalise(email: string): string {
    return email.trim().toLowerCase();
  }
}
