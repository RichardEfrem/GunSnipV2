import { ValidationError } from '../../common/errors/validation.error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ReviewSort } from './dto/list-product-reviews.dto.js';

/**
 * Keyset paging for the product-page review list, across all three of FR-REV-05's orderings.
 *
 * The shared `keyset-cursor` helper walks `(timestamp, id)`, which is every admin list. A review
 * list sorted by rating needs a three-part key — rating first, then recency, then id — because
 * ratings collide constantly: a product with 200 five-star reviews has 200 rows sharing the
 * leading sort column, and a two-part cursor would either repeat them or skip them.
 *
 * The rating tie-break is **always newest-first**, in every sort. "Highest rated" means the best
 * reviews first and the most recent of those first; ordering ties by id would sort by UUID, which
 * is to say randomly, and the reader would see an arbitrary five-star review at the top.
 */
export interface ReviewKeyset {
  rating: number;
  at: Date;
  id: string;
}

export function encodeReviewCursor(keyset: ReviewKeyset): string {
  return Buffer.from(
    JSON.stringify({ r: keyset.rating, at: keyset.at.toISOString(), id: keyset.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeReviewCursor(cursor: string | undefined): ReviewKeyset | undefined {
  if (cursor === undefined) return undefined;

  const keyset = tryDecode(cursor);
  if (keyset === null) {
    throw new ValidationError('That page link is no longer valid — reload the reviews.', { cursor });
  }

  return keyset;
}

/** The `ORDER BY` for a sort, spelled out so the cursor filter below can mirror it exactly. */
export function reviewOrderBy(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput[] {
  const recency: Prisma.ReviewOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

  switch (sort) {
    case 'newest':
      return recency;
    case 'highest':
      return [{ rating: 'desc' }, ...recency];
    case 'lowest':
      return [{ rating: 'asc' }, ...recency];
  }
}

/**
 * Every row that sorts strictly after the cursor under the same ordering, as a Prisma filter.
 *
 * Prisma has no row-value syntax, so the tuple comparison is spelled out in OR form: "past the
 * leading column", or "level with it and past the rest". `newest` has no leading column, so it
 * degrades to the same two-part walk the admin lists use.
 */
export function reviewCursorFilter(
  sort: ReviewSort,
  keyset: ReviewKeyset | undefined,
): Prisma.ReviewWhereInput | undefined {
  if (keyset === undefined) return undefined;

  const afterRecency: Prisma.ReviewWhereInput = {
    OR: [{ createdAt: { lt: keyset.at } }, { createdAt: keyset.at, id: { lt: keyset.id } }],
  };

  if (sort === 'newest') return afterRecency;

  // Descending rating leaves the lower ratings still to come; ascending leaves the higher ones.
  const pastTheRating =
    sort === 'highest' ? { rating: { lt: keyset.rating } } : { rating: { gt: keyset.rating } };

  return { OR: [pastTheRating, { rating: keyset.rating, ...afterRecency }] };
}

function tryDecode(cursor: string): ReviewKeyset | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const { r, at, id } = parsed as { r?: unknown; at?: unknown; id?: unknown };
  if (typeof r !== 'number' || typeof at !== 'string' || typeof id !== 'string') return null;

  const parsedAt = new Date(at);
  return Number.isNaN(parsedAt.getTime()) ? null : { rating: r, at: parsedAt, id };
}
