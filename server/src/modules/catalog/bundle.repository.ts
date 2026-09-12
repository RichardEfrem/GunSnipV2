import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * All Prisma access for bundles (CLAUDE.md).
 *
 * A bundle is read with its components' live stock and prices, because both the card and the
 * add-to-cart decision depend on them: a bundle whose nipper has run out cannot be sold, and its
 * saving is measured against what its parts cost *today*.
 */
const BUNDLE_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  priceIdr: true,
  items: {
    select: {
      quantity: true,
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          priceIdr: true,
          stockOnHand: true,
          stockReserved: true,
          isArchived: true,
          product: {
            select: {
              slug: true,
              name: true,
              status: true,
              images: {
                where: { isPrimary: true },
                select: { url: true, alt: true, blurDataUrl: true },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: [{ position: 'asc' }],
  },
} satisfies Prisma.BundleSelect;

export type BundleRow = Prisma.BundleGetPayload<{ select: typeof BUNDLE_SELECT }>;

/**
 * Live now: switched on, and inside its window when it has one (FR-PROMO-04's scheduling, applied
 * to bundles for the same reason — an operator sets a promotion up in advance and it starts
 * itself).
 */
function liveAt(now: Date): Prisma.BundleWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

@Injectable()
export class BundleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listLive(now: Date, take: number): Promise<BundleRow[]> {
    return this.prisma.bundle.findMany({
      where: liveAt(now),
      orderBy: [{ priceIdr: 'asc' }, { id: 'asc' }],
      take,
      select: BUNDLE_SELECT,
    });
  }

  /** By slug, and only while it is live — an expired bundle is not purchasable by deep link. */
  async findLiveBySlug(slug: string, now: Date): Promise<BundleRow | null> {
    return this.prisma.bundle.findFirst({ where: { slug, ...liveAt(now) }, select: BUNDLE_SELECT });
  }

  /** By id, for a bundle already sitting in a cart. Still only while it is live. */
  async findLiveById(id: string, now: Date): Promise<BundleRow | null> {
    return this.prisma.bundle.findFirst({ where: { id, ...liveAt(now) }, select: BUNDLE_SELECT });
  }
}
