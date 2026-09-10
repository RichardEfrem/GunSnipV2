import type { ProductSort } from '@gunsnip/shared';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Sort option to Prisma ordering (FR-CAT-06).
 *
 * Every entry ends with `id: 'asc'`. Without a unique tiebreaker, two products with the same
 * price have no defined order between them, and Postgres is free to return them differently on
 * each call — which with offset pagination means a product can appear on page 1 and again on
 * page 2, or on neither. That is the classic unstable-pagination bug and the tiebreaker is the
 * whole fix.
 *
 * `price_asc` and `price_desc` order by the denormalised `minPriceIdr`, matching what the card
 * prints and what the price filter narrows on — sorting by one price and displaying another
 * would look like a bug in the sort.
 */
const ORDERS: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  // Nothing has been searched for, so there is no relevance to rank by. Falling back to what
  // has actually sold is the honest reading of "what is most likely what you want" — Phase 4
  // replaces this with a ts_rank against the query when there is one.
  relevance: [{ unitsSold: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
  newest: [{ publishedAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ minPriceIdr: 'asc' }, { id: 'asc' }],
  price_desc: [{ minPriceIdr: 'desc' }, { id: 'asc' }],
  best_selling: [{ unitsSold: 'desc' }, { id: 'asc' }],
  // Review count breaks the tie between a lone five-star review and a hundred of them, which is
  // the difference between a rating that means something and one that does not.
  top_rated: [{ ratingAverageTenths: 'desc' }, { reviewCount: 'desc' }, { id: 'asc' }],
};

/** What a listing gets when the URL names no sort. */
export const DEFAULT_SORT: ProductSort = 'newest';

export function buildProductOrder(sort: ProductSort = DEFAULT_SORT): Prisma.ProductOrderByWithRelationInput[] {
  return ORDERS[sort];
}
