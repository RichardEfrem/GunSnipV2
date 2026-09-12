import { describe, expect, it } from 'vitest';
import { priceRange } from './price-range.js';

/**
 * Price calculation is a mandatory unit-test target (CLAUDE.md Testing). This is the half that
 * decides what a product costs *for sorting and filtering*, which is how a kit ends up in the
 * wrong price bracket long before anyone notices the number on the card.
 */
describe('priceRange', () => {
  it('spans the cheapest and dearest sellable variant', () => {
    expect(
      priceRange([
        { priceIdr: 450_000, isArchived: false },
        { priceIdr: 1_250_000, isArchived: false },
        { priceIdr: 780_000, isArchived: false },
      ]),
    ).toEqual({ minPriceIdr: 450_000, maxPriceIdr: 1_250_000 });
  });

  it('collapses to a point when there is one variant', () => {
    expect(priceRange([{ priceIdr: 450_000, isArchived: false }])).toEqual({
      minPriceIdr: 450_000,
      maxPriceIdr: 450_000,
    });
  });

  it('ignores archived variants, so a retired edition stops skewing the sort', () => {
    expect(
      priceRange([
        { priceIdr: 450_000, isArchived: false },
        { priceIdr: 9_900_000, isArchived: true },
      ]),
    ).toEqual({ minPriceIdr: 450_000, maxPriceIdr: 450_000 });
  });

  it('is zero when nothing is sellable, rather than keeping a price nobody can pay', () => {
    expect(priceRange([{ priceIdr: 9_900_000, isArchived: true }])).toEqual({
      minPriceIdr: 0,
      maxPriceIdr: 0,
    });
  });

  it('is zero for a product with no variants at all', () => {
    expect(priceRange([])).toEqual({ minPriceIdr: 0, maxPriceIdr: 0 });
  });
});
