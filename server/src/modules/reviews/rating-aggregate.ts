/**
 * A product's denormalised rating, recomputed from its approved reviews (FR-ADM-11, FR-REV-05).
 *
 * `review_count` and `rating_average_tenths` are counters on `product` because the card prints
 * "★ 4.8 (142)" on every tile in a 24-card grid and one of the six sorts orders by them
 * (FR-CAT-06) — a correlated aggregate over `review` on every listing query would not hold the
 * 300ms budget. They are a cache, and this is the single function that fills it.
 *
 * **Tenths, as an integer.** 4.8 is 48, for the same reason money is minor units (PRD A2): it
 * sorts and indexes without a float, and the scale is in the column name so no call site can
 * mistake 48 for a rating.
 *
 * Only approved reviews count. That is what makes moderation mean something — a rejected review
 * has to leave the average it was briefly part of, which is why rejecting recomputes too rather
 * than only approving.
 */
export interface RatingAggregate {
  reviewCount: number;
  ratingAverageTenths: number;
}

export function ratingAggregate(approvedRatings: readonly number[]): RatingAggregate {
  if (approvedRatings.length === 0) {
    // Zero, not the last known average. `ProductSummary` reads the count first and renders null
    // rather than a rating, so an unreviewed product shows no stars instead of "★ 0.0".
    return { reviewCount: 0, ratingAverageTenths: 0 };
  }

  const total = approvedRatings.reduce((sum, rating) => sum + rating, 0);

  // Rounded to the nearest tenth rather than truncated: 4.75 should read as 4.8, and truncation
  // would bias every product in the catalogue downward by up to a tenth of a star.
  return {
    reviewCount: approvedRatings.length,
    ratingAverageTenths: Math.round((total * 10) / approvedRatings.length),
  };
}
