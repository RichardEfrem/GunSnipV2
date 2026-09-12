import { describe, expect, it } from 'vitest';
import { ratingHistogram } from './rating-histogram.js';

describe('ratingHistogram', () => {
  it('returns all five buckets, highest first, so the bars never change order', () => {
    const buckets = ratingHistogram(new Map([[5, 2]]));

    expect(buckets.map((bucket) => bucket.rating)).toEqual([5, 4, 3, 2, 1]);
  });

  it('keeps the empty ratings in, because a gap is part of the distribution', () => {
    const buckets = ratingHistogram(new Map([[5, 3], [1, 1]]));

    expect(buckets.map((bucket) => bucket.count)).toEqual([3, 0, 0, 0, 1]);
  });

  it('computes percent against every approved review, not against the largest bucket', () => {
    const buckets = ratingHistogram(new Map([[5, 3], [4, 1]]));

    expect(buckets[0]).toEqual({ rating: 5, count: 3, percent: 75 });
    expect(buckets[1]).toEqual({ rating: 4, count: 1, percent: 25 });
  });

  it('rounds rather than floors, so a half is 50% and not 49%', () => {
    const buckets = ratingHistogram(new Map([[5, 1], [3, 1], [1, 1]]));

    expect(buckets.map((bucket) => bucket.percent)).toEqual([33, 0, 33, 0, 33]);
  });

  it('shows 0% for a rating held by a vanishing share, so no bar is drawn for it', () => {
    const buckets = ratingHistogram(new Map([[5, 299], [1, 1]]));

    expect(buckets[4]).toEqual({ rating: 1, count: 1, percent: 0 });
  });

  it('is all zeroes for a product nobody has reviewed, and divides by nothing', () => {
    const buckets = ratingHistogram(new Map());

    expect(buckets.every((bucket) => bucket.count === 0 && bucket.percent === 0)).toBe(true);
  });
});
