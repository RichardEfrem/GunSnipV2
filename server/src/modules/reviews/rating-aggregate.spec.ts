import { describe, expect, it } from 'vitest';
import { ratingAggregate } from './rating-aggregate.js';

describe('ratingAggregate', () => {
  it('counts the approved reviews and averages them in tenths', () => {
    expect(ratingAggregate([5, 5, 4])).toEqual({ reviewCount: 3, ratingAverageTenths: 47 });
  });

  it('keeps a whole-star average as a whole number of tenths', () => {
    expect(ratingAggregate([4, 4, 4])).toEqual({ reviewCount: 3, ratingAverageTenths: 40 });
  });

  it('rounds to the nearest tenth rather than truncating, so 4.75 reads as 4.8', () => {
    expect(ratingAggregate([5, 5, 5, 4]).ratingAverageTenths).toBe(48);
  });

  it('is zero on both counters when nothing is approved, not the last known average', () => {
    expect(ratingAggregate([])).toEqual({ reviewCount: 0, ratingAverageTenths: 0 });
  });

  it('handles a single review', () => {
    expect(ratingAggregate([3])).toEqual({ reviewCount: 1, ratingAverageTenths: 30 });
  });

  it('never produces a fractional tenth, which the integer column could not hold', () => {
    for (const ratings of [[1, 2], [5, 4, 3, 2, 1], [3, 3, 4], [2, 5, 5, 1, 4, 4, 3]]) {
      expect(Number.isInteger(ratingAggregate(ratings).ratingAverageTenths)).toBe(true);
    }
  });

  it('stays within the 10–50 range a 1–5 star scale can produce', () => {
    expect(ratingAggregate([1, 1, 1]).ratingAverageTenths).toBe(10);
    expect(ratingAggregate([5, 5, 5]).ratingAverageTenths).toBe(50);
  });
});
