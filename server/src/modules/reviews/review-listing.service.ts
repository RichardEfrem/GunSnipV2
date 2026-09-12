import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  DEFAULT_PRODUCT_REVIEW_PAGE_SIZE,
  type ListProductReviewsDto,
} from './dto/list-product-reviews.dto.js';
import type { ProductReviewsPage } from './entities/product-review.entity.js';
import { decodeReviewCursor, encodeReviewCursor, reviewCursorFilter, reviewOrderBy } from './review-cursor.js';
import { ReviewRepository } from './review.repository.js';

/**
 * The reviews a product page shows (FR-REV-05).
 *
 * Only APPROVED rows, in all three orderings, with the photos-only filter — and the summary
 * above them computed over the whole approved set rather than the page, so the histogram does
 * not move as the reader pages through it.
 */
@Injectable()
export class ReviewListingService {
  constructor(private readonly reviews: ReviewRepository) {}

  async listForProduct(slug: string, query: ListProductReviewsDto): Promise<ProductReviewsPage> {
    const product = await this.reviews.findProductIdBySlug(slug);
    if (product === null) throw new NotFoundError('No product with that slug.', { slug });

    const sort = query.sort ?? 'newest';
    const limit = query.limit ?? DEFAULT_PRODUCT_REVIEW_PAGE_SIZE;

    const where: Prisma.ReviewWhereInput = {
      productId: product.id,
      status: 'APPROVED',
      ...(query.withPhotos === true ? { photos: { some: {} } } : {}),
      ...reviewCursorFilter(sort, decodeReviewCursor(query.cursor)),
    };

    // The summary is fetched alongside the page rather than only on the first: the product page
    // re-fetches this endpoint when the sort or filter changes, and a response whose histogram
    // was missing on page two would make the caller cache state it should not have to.
    const [summary, rows] = await Promise.all([
      this.reviews.summarise(product.id),
      // One extra row, so "there is a next page" is known rather than guessed.
      this.reviews.listApproved(where, reviewOrderBy(sort), limit + 1),
    ]);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    return {
      summary,
      items,
      nextCursor:
        hasMore && last !== undefined
          ? encodeReviewCursor({ rating: last.rating, at: new Date(last.createdAt), id: last.id })
          : null,
    };
  }
}
