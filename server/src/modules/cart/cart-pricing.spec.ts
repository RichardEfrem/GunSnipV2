import { describe, expect, it } from 'vitest';
import { countedLines, lineTotal, totalsFor } from './cart-pricing.js';
import type { CartLine } from './entities/cart.entity.js';

/**
 * Price calculation — a mandatory unit-test target (CLAUDE.md Testing).
 *
 * These assert the money rules rather than the plumbing: that the subtotal follows selection
 * and purchasability, that quantity multiplies, that the total is subtotal − discount + shipping,
 * and that nothing here ever produces a non-integer.
 */
function line(overrides: Partial<CartLine> = {}): CartLine {
  const unitPriceIdr = overrides.unitPriceIdr ?? 100_000;
  const quantity = overrides.quantity ?? 1;

  return {
    id: 'line-1',
    quantity,
    isSelected: true,
    isPurchasable: true,
    notices: [],
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
      line({ id: 'a', unitPriceIdr: 385_000, lineTotalIdr: 385_000 }),
      line({ id: 'b', unitPriceIdr: 95_000, lineTotalIdr: 95_000 }),
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

  it('excludes a line that cannot be bought, even when it is selected (FR-CART-04)', () => {
    const totals = totalsFor([
      line({ id: 'a', lineTotalIdr: 100_000 }),
      line({ id: 'b', lineTotalIdr: 250_000, isPurchasable: false }),
    ]);

    expect(totals.subtotalIdr).toBe(100_000);
    expect(totals.selectedQuantity).toBe(1);
    expect(countedLines([line({ isPurchasable: false })])).toEqual([]);
  });

  it('multiplies by quantity', () => {
    const totals = totalsFor([line({ unitPriceIdr: 42_000, quantity: 3, lineTotalIdr: 126_000 })]);

    expect(totals.subtotalIdr).toBe(126_000);
    expect(totals.selectedQuantity).toBe(3);
  });

  it('adds shipping and takes off the discount (FR-CART-05)', () => {
    const totals = totalsFor([line({ lineTotalIdr: 1_730_000 })], {
      shippingIdr: 22_000,
      discountIdr: 100_000,
    });

    expect(totals).toMatchObject({
      subtotalIdr: 1_730_000,
      discountIdr: 100_000,
      shippingIdr: 22_000,
      totalIdr: 1_652_000,
    });
  });

  it('charges no shipping when nothing counts', () => {
    const totals = totalsFor([line({ isSelected: false })], { shippingIdr: 15_000, discountIdr: 0 });

    expect(totals.shippingIdr).toBe(0);
    expect(totals.totalIdr).toBe(0);
  });

  it('never lets a discount take the total below zero', () => {
    const totals = totalsFor([line({ lineTotalIdr: 30_000 })], { shippingIdr: 15_000, discountIdr: 90_000 });

    expect(totals.discountIdr).toBe(45_000);
    expect(totals.totalIdr).toBe(0);
  });

  it('is zero for an empty cart rather than null', () => {
    expect(totalsFor([])).toEqual({
      subtotalIdr: 0,
      discountIdr: 0,
      shippingIdr: 0,
      totalIdr: 0,
      lineCount: 0,
      selectedQuantity: 0,
    });
  });

  it('is zero when every line is deselected', () => {
    const totals = totalsFor([line({ isSelected: false }), line({ id: 'b', isSelected: false })]);

    expect(totals.subtotalIdr).toBe(0);
    expect(totals.lineCount).toBe(2);
  });

  it('keeps money an integer (PRD A2, CLAUDE.md non-negotiable #1)', () => {
    const totals = totalsFor(
      [
        line({ unitPriceIdr: 1_250_000, quantity: 7, lineTotalIdr: lineTotal(1_250_000, 7) }),
        line({ id: 'b', unitPriceIdr: 333_333, quantity: 3, lineTotalIdr: lineTotal(333_333, 3) }),
      ],
      { shippingIdr: 22_000, discountIdr: 33_333 },
    );

    expect(Number.isInteger(totals.totalIdr)).toBe(true);
    expect(totals.subtotalIdr).toBe(8_750_000 + 999_999);
    expect(totals.totalIdr).toBe(8_750_000 + 999_999 + 22_000 - 33_333);
  });

  it('multiplies before summing, so a quantity never rounds away', () => {
    expect(lineTotal(65_000, 4)).toBe(260_000);
    expect(lineTotal(0, 5)).toBe(0);
  });
});
