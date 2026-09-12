import { describe, expect, it } from 'vitest';
import { revalidateLine, type LineState } from './cart-revalidation.js';

/**
 * FR-CART-04: price and stock changes since a line was added are surfaced, never applied
 * silently. Each case is one of the sentences DESIGN.md §3.6 promises the customer.
 */
function state(overrides: Partial<LineState> = {}): LineState {
  return {
    requestedQuantity: 1,
    unitPriceIdr: 320_000,
    priceAtAddIdr: 320_000,
    availableQuantity: 8,
    isSellable: true,
    ...overrides,
  };
}

describe('cart line revalidation', () => {
  it('leaves an unchanged line alone', () => {
    expect(revalidateLine(state({ requestedQuantity: 2 }))).toEqual({
      quantity: 2,
      isPurchasable: true,
      notices: [],
    });
  });

  it('says the price changed, and from what (price went up)', () => {
    const result = revalidateLine(state({ unitPriceIdr: 350_000, priceAtAddIdr: 320_000 }));

    expect(result.notices).toEqual([{ kind: 'PRICE_CHANGED', previousUnitPriceIdr: 320_000 }]);
    expect(result.isPurchasable).toBe(true);
  });

  it('says so when the price drops too', () => {
    const result = revalidateLine(state({ unitPriceIdr: 290_000, priceAtAddIdr: 320_000 }));

    expect(result.notices).toEqual([{ kind: 'PRICE_CHANGED', previousUnitPriceIdr: 320_000 }]);
  });

  it('reduces the quantity to what exists and says what was asked for ("Only 2 left")', () => {
    expect(revalidateLine(state({ requestedQuantity: 5, availableQuantity: 2 }))).toEqual({
      quantity: 2,
      isPurchasable: true,
      notices: [{ kind: 'QUANTITY_REDUCED', requestedQuantity: 5 }],
    });
  });

  it('does not reduce a quantity that exactly matches stock', () => {
    const result = revalidateLine(state({ requestedQuantity: 2, availableQuantity: 2 }));

    expect(result).toEqual({ quantity: 2, isPurchasable: true, notices: [] });
  });

  it('reports both a reduction and a price change on the same line', () => {
    const result = revalidateLine(
      state({ requestedQuantity: 4, availableQuantity: 3, unitPriceIdr: 99_000, priceAtAddIdr: 95_000 }),
    );

    expect(result.quantity).toBe(3);
    expect(result.notices.map((notice) => notice.kind)).toEqual(['QUANTITY_REDUCED', 'PRICE_CHANGED']);
  });

  it('keeps an out-of-stock line, at the quantity asked for, but not as something to buy', () => {
    expect(revalidateLine(state({ requestedQuantity: 3, availableQuantity: 0 }))).toEqual({
      quantity: 3,
      isPurchasable: false,
      notices: [{ kind: 'OUT_OF_STOCK' }],
    });
  });

  it('treats over-reserved stock (negative availability) as out of stock', () => {
    expect(revalidateLine(state({ availableQuantity: -1 })).notices).toEqual([{ kind: 'OUT_OF_STOCK' }]);
  });

  it('marks an archived or unpublished variant unavailable regardless of stock', () => {
    expect(revalidateLine(state({ isSellable: false, availableQuantity: 20 }))).toEqual({
      quantity: 1,
      isPurchasable: false,
      notices: [{ kind: 'UNAVAILABLE' }],
    });
  });
});
