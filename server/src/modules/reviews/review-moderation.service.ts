import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { type CursorPage, toCursorPage } from '../../common/pagination/cursor-page.js';
import { decodeCursor, encodeCursor, keysetFilter } from '../../common/pagination/keyset-cursor.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  DEFAULT_REVIEW_PAGE_SIZE,
  type ListReviewsDto,
  type ModerateReviewDto,
  type ReplyToReviewDto,
} from './dto/moderate-review.dto.js';
import type { AdminReview, ReviewQueueCounts } from './entities/admin-review.entity.js';
import { ReviewRepository } from './review.repository.js';

/**
 * The review moderation queue (FR-ADM-11, FR-REV-06).
 *
 * Only APPROVED reviews reach the storefront, so this is the gate between what a customer wrote
 * and what the product page shows — and, through the rating counters, what every product card in
 * the catalogue claims.
 *
 * Deliberately small. The decision is one column; the consequence is the recomputed aggregate,
 * and that belongs in the same transaction as the decision, which makes it the repository's.
 */
@Injectable()
export class ReviewModerationService {
  constructor(private readonly reviews: ReviewRepository) {}

  async list(query: ListReviewsDto): Promise<CursorPage<AdminReview>> {
    const limit = query.limit ?? DEFAULT_REVIEW_PAGE_SIZE;
    const rows = await this.reviews.list(this.listWhere(query), limit + 1);

    return toCursorPage(rows, limit, (row) => encodeCursor({ at: new Date(row.createdAt), id: row.id }));
  }

  async counts(): Promise<ReviewQueueCounts> {
    return this.reviews.counts();
  }

  async detail(id: string): Promise<AdminReview> {
    const review = await this.reviews.findById(id);
    if (review === null) throw new NotFoundError('No review with that id.', { id });

    return review;
  }

  /**
   * Approve or reject (FR-ADM-11).
   *
   * Re-deciding a review that already has that status is refused rather than quietly re-run. It
   * would be harmless — the recount is idempotent — but it would also move `moderated_at`, and
   * an operator double-clicking would rewrite the record of when the decision was actually made.
   */
  async moderate(id: string, dto: ModerateReviewDto): Promise<AdminReview> {
    const review = await this.detail(id);

    if (review.status === dto.status) {
      throw new ConflictError(`That review is already ${dto.status.toLowerCase()}.`, { id, status: review.status });
    }

    return this.reviews.moderate(id, dto.status, new Date());
  }

  async reply(id: string, dto: ReplyToReviewDto): Promise<AdminReview> {
    await this.detail(id);

    return this.reviews.setReply(id, dto.adminReply ?? null);
  }

  private listWhere(query: ListReviewsDto): Prisma.ReviewWhereInput {
    const term = query.q?.trim();

    return {
      // The pending queue is the default, because it is the only one with work in it.
      status: query.status ?? 'PENDING',
      ...(term === undefined || term.length === 0
        ? {}
        : {
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { body: { contains: term, mode: 'insensitive' } },
              { authorName: { contains: term, mode: 'insensitive' } },
              { product: { name: { contains: term, mode: 'insensitive' } } },
            ],
          }),
      ...keysetFilter(decodeCursor(query.cursor), 'createdAt'),
    };
  }
}
