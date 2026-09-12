import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * All Prisma access for review invites (CLAUDE.md).
 *
 * An invite is a credential with a lifecycle of its own — minted on delivery, spent once, then
 * dead — hanging off an order line rather than off a review. It gets its own repository because
 * the review repository's job is reviews, and because the one write that spans both (spending an
 * invite to create a review) has to be a single transaction, which is the review aggregate's.
 */
const INVITE_SELECT = {
  id: true,
  token: true,
  expiresAt: true,
  usedAt: true,
  orderItem: {
    select: {
      id: true,
      productNameSnapshot: true,
      order: { select: { orderNumber: true, customerSnapshot: true } },
      variant: {
        select: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
              images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReviewInviteSelect;

export type ReviewInviteRow = Prisma.ReviewInviteGetPayload<{ select: typeof INVITE_SELECT }>;

export interface NewInvite {
  orderItemId: string;
  token: string;
  expiresAt: Date;
  /** For the email that carries the link. */
  productName: string;
}

@Injectable()
export class ReviewInviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The lines of a delivered order that can still be reviewed.
   *
   * Excludes lines that already have an invite, so marking an order delivered twice — an
   * operator correcting a mis-click, a status advanced and reverted — does not mint a second
   * live credential for the same line. Excludes lines whose variant has since been deleted:
   * `order_item.variant_id` is `SET NULL` on purpose so history survives, but there is no
   * product left to point a review at.
   */
  async findInvitableItems(orderId: string): Promise<{ orderItemId: string; productName: string }[]> {
    const rows = await this.prisma.orderItem.findMany({
      where: { orderId, invites: { none: {} }, variantId: { not: null } },
      select: { id: true, productNameSnapshot: true },
      orderBy: [{ productNameSnapshot: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({ orderItemId: row.id, productName: row.productNameSnapshot }));
  }

  async issue(invites: readonly NewInvite[]): Promise<void> {
    if (invites.length === 0) return;

    await this.prisma.reviewInvite.createMany({
      data: invites.map((invite) => ({
        orderItemId: invite.orderItemId,
        token: invite.token,
        expiresAt: invite.expiresAt,
      })),
      // Belt and braces alongside `findInvitableItems`: two deliveries racing would both see an
      // uninvited line, and the unique index on `token` is not the one that would catch it.
      skipDuplicates: true,
    });
  }

  async findByToken(token: string): Promise<ReviewInviteRow | null> {
    return this.prisma.reviewInvite.findUnique({ where: { token }, select: INVITE_SELECT });
  }
}
