import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** All Prisma access for `notify_request` (CLAUDE.md). */

export interface NotifyRequestInput {
  variantId: string;
  email: string;
  sessionId: string;
  userId: string | null;
}

@Injectable()
export class NotifyRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The variant exists, is sellable in principle, and its product is visible. */
  async isNotifiableVariant(variantId: string): Promise<boolean> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isArchived: false, product: { status: 'PUBLISHED' } },
      select: { id: true },
    });

    return variant !== null;
  }

  /**
   * Records interest, or refreshes it if this address had already asked.
   *
   * An upsert on the `(variant_id, email)` unique index, so a second submission is a no-op
   * rather than a 409 — asking twice is not an error, and telling the caller "you already did"
   * would leak that the address is on the list.
   *
   * `notified_at` is cleared on re-registration: someone asking again after a previous restock
   * mail wants to hear about the next one.
   */
  async register(input: NotifyRequestInput): Promise<void> {
    await this.prisma.notifyRequest.upsert({
      where: { variantId_email: { variantId: input.variantId, email: input.email } },
      create: {
        variantId: input.variantId,
        email: input.email,
        sessionId: input.sessionId,
        userId: input.userId,
      },
      update: { notifiedAt: null, sessionId: input.sessionId, userId: input.userId },
    });
  }
}
