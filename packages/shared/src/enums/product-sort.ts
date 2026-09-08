/**
 * Sort options for listing and search (FR-CAT-06). These strings are the literal `?sort=`
 * values, so the API and the URL builder cannot drift apart.
 */
export const PRODUCT_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'best_selling',
  'top_rated',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];
