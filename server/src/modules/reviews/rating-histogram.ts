/**
 * The 1–5 distribution under a product's rating (FR-REV-05).
 *
 * Always five buckets, always in descending order, zeroes included. A histogram that omitted its
 * empty rows would render as a bar chart with rows missing from the middle — the shape of the
 * distribution is the information, and a gap is part of the shape.
 */
export interface RatingBucket {
  rating: 1 | 2 | 3 | 4 | 5;
  count: number;
  /**
   * Whole percent of approved reviews at this rating, for the bar width. Computed here rather
   * than in the component so the bars cannot disagree with the counts beside them.
   */
  percent: number;
}

export type RatingHistogram = readonly [RatingBucket, RatingBucket, RatingBucket, RatingBucket, RatingBucket];

const RATINGS = [5, 4, 3, 2, 1] as const;

export function ratingHistogram(countsByRating: ReadonlyMap<number, number>): RatingHistogram {
  const total = [...countsByRating.values()].reduce((sum, count) => sum + count, 0);

  return RATINGS.map((rating) => {
    const count = countsByRating.get(rating) ?? 0;

    return {
      rating,
      count,
      // Rounded, not floored: a rating held by one review in three hundred should read as 0%
      // rather than showing a bar, and one held by half should read as 50% rather than 49%.
      percent: total === 0 ? 0 : Math.round((count * 100) / total),
    };
  }) as unknown as RatingHistogram;
}
