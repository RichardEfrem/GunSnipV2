/**
 * The denormalised `min_price_idr` / `max_price_idr` on a product, recomputed from its variants.
 *
 * Those two columns exist because both price sorts (FR-CAT-06) and the price-range filter
 * (FR-CAT-04) order and range-scan products by price, which Prisma cannot express as an
 * aggregate over a relation. They are a cache, and this is the single function that fills it —
 * every write that touches a variant's price calls it, so the cache cannot be updated one way
 * in one place and another way somewhere else.
 *
 * Archived variants are excluded: they are not purchasable, so a retired premium edition must
 * not keep a product at the top of a price-descending sort forever.
 *
 * A product with no sellable variants gets 0/0 rather than being left at its last known range.
 * Zero sorts to the bottom and matches no meaningful price filter, which is the right place for
 * something nobody can buy — and a stale range would advertise a price that no longer exists.
 */
export interface VariantPrice {
  priceIdr: number;
  isArchived: boolean;
}

export interface PriceRange {
  minPriceIdr: number;
  maxPriceIdr: number;
}

export function priceRange(variants: readonly VariantPrice[]): PriceRange {
  const prices = variants.filter((variant) => !variant.isArchived).map((variant) => variant.priceIdr);

  if (prices.length === 0) return { minPriceIdr: 0, maxPriceIdr: 0 };

  return { minPriceIdr: Math.min(...prices), maxPriceIdr: Math.max(...prices) };
}
