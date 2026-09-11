import { describe, expect, it } from 'vitest';
import { lineTotal, totalsFor } from './cart-pricing.js';
import type { CartLine } from './entities/cart.entity.js';

/**
 * Price calculation — a mandatory unit-test target (CLAUDE.md Testing).
 *
 * These assert the money rules rather than the plumbing: that the subtotal follows selection,
 * that quantity multiplies, and that nothing here ever produces a non-integer.
 */
function line(overrides: Partial<CartLine> = {}): CartLine {
  const unitPriceIdr = overrides.unitPriceIdr ?? 100_000;
  const quantity = overrides.quantity ?? 1;

  return {
    id: 'line-1',
    quantity,
    isSelected: true,
    variantId: 'variant-1',
    sku: 'SKU-1',
    variantName: null,
    optionValues: {},
    productSlug: 'a-kit',
    productName: 'A Kit',
    image: null,
    unitPriceIdr,
    lineTotalIdr: lineTotal(unitPriceIdr, quantity),
    stockState: 'IN_STOCK',
    availableQuantity: 10,
    ...overrides,
  };
}

describe('cart pricing', () => {
  it('sums the selected lines', () => {
    const totals = totalsFor([
      line({ id: 'a', unitPriceIdr: 385_000, quantity: 1, lineTotalIdr: 385_000 }),
      line({ id: 'b', unitPriceIdr: 95_000, quantity: 1, lineTotalIdr: 95_000 }),
    ]);

    expect(totals.subtotalIdr).toBe(480_000);
    expect(totals.lineCount).toBe(2);
    expect(totals.selectedQuantity).toBe(2);
  });

  it('excludes a deselected line from the subtotal but keeps it in the cart (DoD §13.4)', () => {
    const totals = totalsFor([
      line({ id: 'a', unitPriceIdr: 385_000, lineTotalIdr: 385_000 }),
      line({ id: 'b', unitPriceIdr: 95_000, lineTotalIdr: 95_000, isSelected: false }),
    ]);

    expect(totals.subtotalIdr).toBe(385_000);
    // Still there. Deselecting is not removing (FR-CART-03).
    expect(totals.lineCount).toBe(2);
    expect(totals.selectedQuantity).toBe(1);
  });

  it('multiplies by quantity', () => {
    const totals = totalsFor([line({ unitPriceIdr: 42_000, quantity: 3, lineTotalIdr: 126_000 })]);

    expect(totals.subtotalIdr).toBe(126_000);
    expect(totals.selectedQuantity).toBe(3);
  });

  it('is zero for an empty cart rather than null', () => {
    expect(totalsFor([])).toEqual({ subtotalIdr: 0, lineCount: 0, selectedQuantity: 0 });
  });

  it('is zero when every line is deselected', () => {
    const totals = totalsFor([line({ isSelected: false }), line({ id: 'b', isSelected: false })]);

    expect(totals.subtotalIdr).toBe(0);
    expect(totals.lineCount).toBe(2);
  });

  it('keeps money an integer (PRD A2, CLAUDE.md non-negotiable #1)', () => {
    const totals = totalsFor([
      line({ unitPriceIdr: 1_250_000, quantity: 7, lineTotalIdr: lineTotal(1_250_000, 7) }),
      line({ id: 'b', unitPriceIdr: 333_333, quantity: 3, lineTotalIdr: lineTotal(333_333, 3) }),
    ]);

    expect(Number.isInteger(totals.subtotalIdr)).toBe(true);
    expect(totals.subtotalIdr).toBe(8_750_000 + 999_999);
  });

  it('multiplies before summing, so a quantity never rounds away', () => {
    expect(lineTotal(65_000, 4)).toBe(260_000);
    expect(lineTotal(0, 5)).toBe(0);
  });
});
