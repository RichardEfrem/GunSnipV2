import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { CartChangedError } from './errors/cart-changed.error.js';
import { basket, basketLine } from './order.fixtures.js';
import { orderableLines, quotableLines } from './order-lines.js';

const EXIA = basketLine();
const NIPPER = basketLine({
  variantId: 'nipper',
  productId: 'product-nipper',
  productName: 'GodHand Ultimate Nipper',
  unitPriceIdr: 385_000,
});

describe('quotableLines', () => {
  it('prices each selected line from the variant', () => {
    const { lines, unavailableCount } = quotableLines(basket([EXIA, { ...NIPPER, requestedQuantity: 2 }]));

    expect(lines.map((line) => [line.basketLine.variantId, line.quantity, line.lineTotalIdr])).toEqual([
      ['exia', 1, 785_000],
      ['nipper', 2, 770_000],
    ]);
    expect(unavailableCount).toBe(0);
  });

  it('quotes a short line at what exists and says so, like the cart (FR-CART-04)', () => {
    const { lines } = quotableLines(basket([basketLine({ requestedQuantity: 5, stockOnHand: 3, stockReserved: 1 })]));

    expect(lines[0]?.quantity).toBe(2);
    expect(lines[0]?.notices).toEqual([{ kind: 'QUANTITY_REDUCED', requestedQuantity: 5 }]);
  });

  it('surfaces a price change rather than applying it silently', () => {
    const { lines } = quotableLines(basket([basketLine({ unitPriceIdr: 800_000, priceAtAddIdr: 785_000 })]));

    expect(lines[0]?.lineTotalIdr).toBe(800_000);
    expect(lines[0]?.notices).toEqual([{ kind: 'PRICE_CHANGED', previousUnitPriceIdr: 785_000 }]);
  });

  it('leaves out lines that cannot be bought, and counts them', () => {
    const { lines, unavailableCount } = quotableLines(
      basket([EXIA, { ...NIPPER, stockOnHand: 0 }, basketLine({ variantId: 'gone', isSellable: false })]),
    );

    expect(lines.map((line) => line.basketLine.variantId)).toEqual(['exia']);
    expect(unavailableCount).toBe(2);
  });

  it('quotes nothing for a visitor with no cart', () => {
    expect(quotableLines(null)).toEqual({ lines: [], unavailableCount: 0 });
  });
});

describe('orderableLines', () => {
  it('orders what the customer confirmed, priced from the variant', () => {
    const lines = orderableLines(basket([EXIA, { ...NIPPER, requestedQuantity: 2 }]), [
      { cartLineId: 'line-nipper', quantity: 2 },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineTotalIdr).toBe(770_000);
  });

  it('accepts less than the cart holds — the quantity a short line was quoted at', () => {
    const lines = orderableLines(basket([basketLine({ requestedQuantity: 5 })]), [{ cartLineId: 'line-exia', quantity: 3 }]);
    expect(lines[0]?.quantity).toBe(3);
  });

  it('refuses a line the cart no longer holds', () => {
    expect(() => orderableLines(basket([EXIA]), [{ cartLineId: 'line-nipper', quantity: 1 }])).toThrow(CartChangedError);
  });

  it('refuses more than the cart holds', () => {
    expect(() => orderableLines(basket([EXIA]), [{ cartLineId: 'line-exia', quantity: 2 }])).toThrow(CartChangedError);
  });

  it('tells two lines of the same variant apart, which a bundle creates', () => {
    const loose = basketLine({ variantId: 'nipper', unitPriceIdr: 385_000 });
    const bundled = {
      ...basketLine({ variantId: 'nipper' }),
      cartLineId: 'line-bundled-nipper',
      // Its allocated share of the bundle, which is what it must be charged at.
      unitPriceIdr: 280_000,
      bundle: { id: 'bundle-1', name: 'First build starter', slug: 'first-build-starter' },
    };

    const lines = orderableLines(basket([loose, bundled]), [
      { cartLineId: 'line-bundled-nipper', quantity: 1 },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineTotalIdr).toBe(280_000);
    expect(lines[0]?.basketLine.bundle?.name).toBe('First build starter');
  });

  it('refuses a line that was unpublished, naming it', () => {
    const attempt = () => orderableLines(basket([{ ...NIPPER, isSellable: false }]), [{ cartLineId: 'line-nipper', quantity: 1 }]);

    expect(attempt).toThrow(ConflictError);
    expect(attempt).toThrow('GodHand Ultimate Nipper is no longer available.');
  });
});
