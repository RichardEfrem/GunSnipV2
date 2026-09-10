import { describe, expect, it } from 'vitest';
import { availableOf, toProductSummary, toStockState } from './product-mapper.js';
import type { ProductSummaryRow, VariantRow } from './product.repository.js';

/**
 * Availability and the displayed price.
 *
 * These are the derivations a client is never allowed to make for itself, so they are the ones
 * worth pinning down: a wrong stock state sells something that is not there, and a wrong
 * "from" price quotes a number no variant actually charges.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-01T00:00:00Z').getTime();

function variant(overrides: Partial<VariantRow> = {}): VariantRow {
  return {
    id: 'variant-1',
    sku: 'SKU-1',
    name: null,
    optionValues: {},
    priceIdr: 100_000,
    compareAtPriceIdr: null,
    stockOnHand: 10,
    stockReserved: 0,
    isArchived: false,
    position: 0,
    ...overrides,
  };
}

function row(overrides: Partial<ProductSummaryRow> = {}): ProductSummaryRow {
  return {
    id: 'product-1',
    slug: 'mg-nu-gundam',
    name: 'MG 1/100 Nu Gundam',
    type: 'MODEL_KIT',
    publishedAt: new Date(NOW - 200 * DAY_MS),
    unitsSold: 12,
    reviewCount: 0,
    ratingAverageTenths: 0,
    brand: { name: 'Bandai Spirits', slug: 'bandai-spirits' },
    grade: { code: 'MG', name: 'Master Grade' },
    scale: { code: '1/100', name: '1/100' },
    series: { name: 'Universal Century', slug: 'universal-century' },
    images: [],
    variants: [variant()],
    ...overrides,
  };
}

describe('availableOf', () => {
  it('subtracts what orders have already reserved (PRD §8.3)', () => {
    expect(availableOf({ stockOnHand: 10, stockReserved: 3 })).toBe(7);
  });

  it('never reports a negative quantity', () => {
    // Over-reservation should read as "none left", not as a number that breaks every caller
    // downstream that assumes a count.
    expect(availableOf({ stockOnHand: 2, stockReserved: 5 })).toBe(0);
  });
});

describe('toStockState', () => {
  it('is out of stock at zero', () => {
    expect(toStockState(0)).toBe('OUT_OF_STOCK');
  });

  it('is low at or below the threshold, and in stock above it', () => {
    expect(toStockState(1)).toBe('LOW_STOCK');
    expect(toStockState(5)).toBe('LOW_STOCK');
    expect(toStockState(6)).toBe('IN_STOCK');
  });
});

describe('toProductSummary', () => {
  it('sums availability across variants', () => {
    const summary = toProductSummary(
      row({
        variants: [
          variant({ id: 'a', stockOnHand: 4, stockReserved: 1 }),
          variant({ id: 'b', stockOnHand: 2, stockReserved: 0 }),
        ],
      }),
      NOW,
    );

    expect(summary.availableQuantity).toBe(5);
    expect(summary.stockState).toBe('LOW_STOCK');
  });

  it('is out of stock when every variant is spoken for', () => {
    const summary = toProductSummary(
      row({ variants: [variant({ stockOnHand: 3, stockReserved: 3 })] }),
      NOW,
    );

    expect(summary.availableQuantity).toBe(0);
    expect(summary.stockState).toBe('OUT_OF_STOCK');
  });

  it('quotes the cheapest variant and flags that others cost more', () => {
    const summary = toProductSummary(
      row({
        variants: [
          variant({ id: 'a', priceIdr: 250_000, compareAtPriceIdr: 300_000 }),
          variant({ id: 'b', priceIdr: 180_000, compareAtPriceIdr: 200_000 }),
        ],
      }),
      NOW,
    );

    expect(summary.priceIdr).toBe(180_000);
    // The compare-at has to come from the *same* variant, or the card shows a saving nobody
    // can actually get.
    expect(summary.compareAtPriceIdr).toBe(200_000);
    expect(summary.hasPriceRange).toBe(true);
  });

  it('does not claim a price range when every variant costs the same', () => {
    const summary = toProductSummary(
      row({ variants: [variant({ id: 'a' }), variant({ id: 'b' })] }),
      NOW,
    );

    expect(summary.hasPriceRange).toBe(false);
  });

  it('ignores archived variants entirely', () => {
    const summary = toProductSummary(
      row({
        variants: [
          variant({ id: 'gone', priceIdr: 1_000, stockOnHand: 99, isArchived: true }),
          variant({ id: 'live', priceIdr: 500_000, stockOnHand: 7 }),
        ],
      }),
      NOW,
    );

    // A withdrawn variant must not set the "from" price or prop up the stock count.
    expect(summary.priceIdr).toBe(500_000);
    expect(summary.availableQuantity).toBe(7);
    expect(summary.hasPriceRange).toBe(false);
  });

  it('reports no rating rather than zero when nothing has been reviewed', () => {
    const summary = toProductSummary(row({ reviewCount: 0, ratingAverageTenths: 0 }), NOW);

    // Zero would render as a rating of 0.0 — an unreviewed product is unknown, not bad.
    expect(summary.ratingAverage).toBeNull();
  });

  it('converts tenths of a star back to a rating', () => {
    const summary = toProductSummary(row({ reviewCount: 142, ratingAverageTenths: 48 }), NOW);

    expect(summary.ratingAverage).toBe(4.8);
  });

  it('is new for thirty days after publication and not a day longer', () => {
    const justInside = toProductSummary(row({ publishedAt: new Date(NOW - 29 * DAY_MS) }), NOW);
    const justOutside = toProductSummary(row({ publishedAt: new Date(NOW - 31 * DAY_MS) }), NOW);

    expect(justInside.isNew).toBe(true);
    expect(justOutside.isNew).toBe(false);
  });

  it('is never new when it has no publication date', () => {
    expect(toProductSummary(row({ publishedAt: null }), NOW).isNew).toBe(false);
  });
});
