import { Injectable } from '@nestjs/common';
import type { ReviewStatus } from '@gunsnip/shared';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminReview, ReviewQueueCounts } from './entities/admin-review.entity.js';
import type {
  ProductReviewSummary,
  ProductReviewView,
} from './entities/product-review.entity.js';
import { ratingAggregate } from './rating-aggregate.js';
import { ratingHistogram } from './rating-histogram.js';

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

/**
 * What the product page is allowed to see. Narrower than the admin select on purpose: no status,
 * no moderation timestamp, and above all no `sessionId` or `userId` — a public list that carried
 * those would let anyone correlate two reviews to one person.
 */
const PUBLIC_SELECT = {
  id: true,
  authorName: true,
  rating: true,
  title: true,
  body: true,
  isVerifiedPurchase: true,
  buildTimeMinutes: true,
  experiencedDifficulty: true,
  toolsUsed: true,
  adminReply: true,
  createdAt: true,
  photos: { select: { id: true, url: true, alt: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ReviewSelect;

type PublicReviewRow = Prisma.ReviewGetPayload<{ select: typeof PUBLIC_SELECT }>;

/** What a submitted review is made of, once the invite has said which product it is for. */
export interface NewReview {
  productId: string;
  orderItemId: string;
  sessionId: string;
  userId: string | null;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  buildTimeMinutes: number | null;
  experiencedDifficulty: Prisma.ReviewCreateInput['experiencedDifficulty'];
  toolsUsed: readonly string[];
  photos: readonly { url: string; alt: string }[];
}

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

  /**
   * The product a slug names, or null.
   *
   * A one-column read of another aggregate's table, which is the narrowest way to let the review
   * routes be addressed the way the storefront addresses everything else — by slug. The
   * alternative is a call into `CatalogService` for an id, which would make the review module
   * depend on the whole catalogue to answer a question it can ask in a single index probe.
   */
  async findProductIdBySlug(slug: string): Promise<{ id: string; type: string } | null> {
    return this.prisma.product.findUnique({ where: { slug }, select: { id: true, type: true } });
  }

  /**
   * One page of a product's approved reviews (FR-REV-05).
   *
   * `where` and `orderBy` are built by the service from the sort and filter, because the shape
   * of a keyset walk depends on the ordering it walks and the two have to be written together
   * or they disagree.
   */
  async listApproved(
    where: Prisma.ReviewWhereInput,
    orderBy: Prisma.ReviewOrderByWithRelationInput[],
    take: number,
  ): Promise<ProductReviewView[]> {
    const rows = await this.prisma.review.findMany({ where, orderBy, take, select: PUBLIC_SELECT });

    return rows.map(toPublicReview);
  }

  /**
   * The histogram and counts above the list (FR-REV-05).
   *
   * Over every approved review of the product, never over the page — a distribution that
   * described the current page would change as the reader paged through it. Two grouped queries
   * rather than five counts, and the photos tally is a separate count because "has at least one
   * photo" is a relation test, not a column.
   */
  async summarise(productId: string): Promise<ProductReviewSummary> {
    const approved = { productId, status: 'APPROVED' } satisfies Prisma.ReviewWhereInput;

    const [byRating, withPhotosCount] = await Promise.all([
      this.prisma.review.groupBy({ by: ['rating'], where: approved, _count: { _all: true } }),
      this.prisma.review.count({ where: { ...approved, photos: { some: {} } } }),
    ]);

    const counts = new Map(byRating.map((row) => [row.rating, row._count._all]));
    const ratings = byRating.flatMap((row) => Array.from({ length: row._count._all }, () => row.rating));

    // The same function the product counter is built from, so the number above the histogram and
    // the number on the product card can never disagree.
    const aggregate = ratingAggregate(ratings);

    return {
      count: aggregate.reviewCount,
      averageTenths: aggregate.ratingAverageTenths,
      histogram: ratingHistogram(counts),
      withPhotosCount,
    };
  }

  /**
   * Writes a review and spends the invite that authorised it — one transaction, because a review
   * stored against a still-live invite is a second review waiting to happen, and an invite spent
   * without its review is a customer told to go away (CLAUDE.md non-negotiable #7).
   *
   * No rating counters move here. The review lands `PENDING` and counts for nothing until a
   * moderator approves it, which is the one place the aggregate is recomputed.
   */
  async createFromInvite(inviteId: string, review: NewReview, at: Date): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      // Spend the invite first, and only if it is still unspent. Two submissions racing on one
      // link both pass the service's check; this `updateMany` is what makes exactly one of them
      // win, because the second updates no rows.
      const spent = await tx.reviewInvite.updateMany({
        where: { id: inviteId, usedAt: null },
        data: { usedAt: at },
      });

      if (spent.count === 0) {
        throw new ConflictError('That review link has already been used — thank you for the review.', {
          inviteId,
        });
      }

      const created = await tx.review.create({
        data: {
          productId: review.productId,
          orderItemId: review.orderItemId,
          sessionId: review.sessionId,
          userId: review.userId,
          authorName: review.authorName,
          rating: review.rating,
          title: review.title,
          body: review.body,
          // The invite came from a delivered order line, so the purchase is a fact rather than
          // a claim (FR-REV-03). Nothing else in the system may set this.
          isVerifiedPurchase: true,
          buildTimeMinutes: review.buildTimeMinutes,
          experiencedDifficulty: review.experiencedDifficulty,
          toolsUsed: [...review.toolsUsed],
          photos: {
            create: review.photos.map((photo, position) => ({ ...photo, position })),
          },
        },
        select: { id: true },
      });

      return created.id;
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

function toPublicReview(row: PublicReviewRow): ProductReviewView {
  return {
    id: row.id,
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
    createdAt: row.createdAt.toISOString(),
  };
}
