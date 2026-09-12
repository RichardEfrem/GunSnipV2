import { Injectable } from '@nestjs/common';
import type { ReviewStatus } from '@gunsnip/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminReview, ReviewQueueCounts } from './entities/admin-review.entity.js';
import { ratingAggregate } from './rating-aggregate.js';

/**
 * All Prisma access for reviews (CLAUDE.md).
 *
 * Moderation is a transaction, and that is the whole point of this file: a review's status and
 * the product counters it feeds have to move together. A review approved without the counters
 * being recomputed leaves a product whose card says "★ 4.8 (142)" while 143 reviews are visible
 * underneath it — a discrepancy nobody notices until a customer counts.
 */
const ADMIN_SELECT = {
  id: true,
  status: true,
  authorName: true,
  rating: true,
  title: true,
  body: true,
  isVerifiedPurchase: true,
  buildTimeMinutes: true,
  experiencedDifficulty: true,
  toolsUsed: true,
  adminReply: true,
  moderatedAt: true,
  createdAt: true,
  product: { select: { id: true, name: true, slug: true } },
  photos: { select: { id: true, url: true, alt: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof ADMIN_SELECT }>;

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(where: Prisma.ReviewWhereInput, take: number): Promise<AdminReview[]> {
    const rows = await this.prisma.review.findMany({
      where,
      // Oldest first within the pending queue would be the fairer order, but a moderator wants
      // the newest first — a backlog is worked from the top and the old end is triaged, not read.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: ADMIN_SELECT,
    });

    return rows.map(toAdminReview);
  }

  async findById(id: string): Promise<AdminReview | null> {
    const row = await this.prisma.review.findUnique({ where: { id }, select: ADMIN_SELECT });
    return row === null ? null : toAdminReview(row);
  }

  async counts(): Promise<ReviewQueueCounts> {
    const rows = await this.prisma.review.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus = new Map(rows.map((row) => [row.status, row._count._all]));

    return {
      pending: byStatus.get('PENDING') ?? 0,
      approved: byStatus.get('APPROVED') ?? 0,
      rejected: byStatus.get('REJECTED') ?? 0,
    };
  }

  /**
   * Moves a review to a decided status and rebuilds its product's rating counters from the
   * approved reviews as they stand afterwards — in one transaction.
   *
   * Recomputed from scratch rather than nudged by one. An incremental update has to be right
   * every single time or the counter drifts permanently, and there is no way to notice; a full
   * recount over one product's reviews is a handful of rows and is correct by construction.
   */
  async moderate(id: string, status: ReviewStatus, at: Date): Promise<AdminReview> {
    return this.prisma.$transaction(async (tx) => {
      const { productId } = await tx.review.update({
        where: { id },
        data: { status, moderatedAt: at },
        select: { productId: true },
      });

      const approved = await tx.review.findMany({
        where: { productId, status: 'APPROVED' },
        select: { rating: true },
      });

      await tx.product.update({
        where: { id: productId },
        data: ratingAggregate(approved.map((review) => review.rating)),
      });

      return toAdminReview(await tx.review.findUniqueOrThrow({ where: { id }, select: ADMIN_SELECT }));
    });
  }

  /** The reply is copy, not moderation: it changes no counter and no status. */
  async setReply(id: string, adminReply: string | null): Promise<AdminReview> {
    return toAdminReview(
      await this.prisma.review.update({ where: { id }, data: { adminReply }, select: ADMIN_SELECT }),
    );
  }
}

function toAdminReview(row: ReviewRow): AdminReview {
  return {
    id: row.id,
    status: row.status,
    product: row.product,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    isVerifiedPurchase: row.isVerifiedPurchase,
    buildTimeMinutes: row.buildTimeMinutes,
    experiencedDifficulty: row.experiencedDifficulty,
    toolsUsed: row.toolsUsed,
    photos: row.photos,
    adminReply: row.adminReply,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
