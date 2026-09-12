import { describe, expect, it } from 'vitest';
import { NOW, basketLine, voucherTerms } from './order.fixtures.js';
import type { OrderLine } from './order-lines.js';
import { priceOrder } from './order-pricing.js';

/**
 * Order price calculation — a mandatory unit-test target (CLAUDE.md Testing). The checkout
 * summary and the placed order are both priced by `priceOrder`, so these are the rules for what a
 * customer is shown *and* what they are charged.
 */
function line(unitPriceIdr: number, quantity = 1, overrides: Parameters<typeof basketLine>[0] = {}): OrderLine {
  return {
    basketLine: basketLine({ unitPriceIdr, ...overrides }),
    quantity,
    lineTotalIdr: unitPriceIdr * quantity,
  };
}

const NIPPER = { productId: 'product-nipper', categoryIds: ['cat-tools-nippers', 'cat-tools'] };

describe('priceOrder', () => {
  it('is subtotal + shipping when there is no voucher', () => {
    const pricing = priceOrder([line(785_000), line(385_000, 1, NIPPER)], 22_000, null, NOW);

    expect(pricing).toEqual({
      subtotalIdr: 1_170_000,
      discountIdr: 0,
      shippingIdr: 22_000,
      totalIdr: 1_192_000,
      voucher: null,
    });
  });

  it('multiplies by quantity', () => {
    expect(priceOrder([line(95_000, 3)], 0, null, NOW).subtotalIdr).toBe(285_000);
  });

  it('charges no shipping on an empty order, whatever rate was looked up', () => {
    const pricing = priceOrder([], 55_000, null, NOW);

    expect(pricing.shippingIdr).toBe(0);
    expect(pricing.totalIdr).toBe(0);
  });

  it('takes a percentage voucher off the subtotal, rounding down', () => {
    const voucher = { terms: voucherTerms({ percentOff: 10 }), sessionRedemptions: 0 };
    const pricing = priceOrder([line(785_005)], 15_000, voucher, NOW);

    expect(pricing.discountIdr).toBe(78_500);
    expect(pricing.totalIdr).toBe(785_005 - 78_500 + 15_000);
    expect(pricing.voucher).toEqual({ isValid: true, discountIdr: 78_500 });
  });

  it('waives the real shipping for this address with a free-shipping voucher', () => {
    const voucher = { terms: voucherTerms({ type: 'FREE_SHIPPING', percentOff: null }), sessionRedemptions: 0 };
    const pricing = priceOrder([line(385_000, 1, NIPPER)], 75_000, voucher, NOW);

    expect(pricing.discountIdr).toBe(75_000);
    expect(pricing.totalIdr).toBe(385_000);
  });

  it('applies scope: a kits voucher ignores the nipper', () => {
    const voucher = {
      terms: voucherTerms({ percentOff: 10, scope: { categoryIds: new Set(['cat-kits']), productIds: new Set() } }),
      sessionRedemptions: 0,
    };

    expect(priceOrder([line(785_000), line(385_000, 1, NIPPER)], 0, voucher, NOW).discountIdr).toBe(78_500);
  });

  it('charges full price when the voucher no longer qualifies, and says why', () => {
    const voucher = { terms: voucherTerms({ minSpendIdr: 1_000_000 }), sessionRedemptions: 0 };
    const pricing = priceOrder([line(785_000)], 15_000, voucher, NOW);

    expect(pricing.discountIdr).toBe(0);
    expect(pricing.totalIdr).toBe(800_000);
    expect(pricing.voucher).toMatchObject({ isValid: false, rejection: { reason: 'MIN_SPEND_NOT_MET' } });
  });

  it('refuses a voucher whose usage limit was reached by other orders', () => {
    const voucher = { terms: voucherTerms({ usageLimit: 100, usedCount: 100 }), sessionRedemptions: 0 };
    expect(priceOrder([line(785_000)], 0, voucher, NOW).discountIdr).toBe(0);
  });

  it('refuses a voucher this session has already used up', () => {
    const voucher = { terms: voucherTerms({ perSessionLimit: 1 }), sessionRedemptions: 1 };
    expect(priceOrder([line(785_000)], 0, voucher, NOW).discountIdr).toBe(0);
  });

  it('never produces a negative total', () => {
    const voucher = {
      terms: voucherTerms({ type: 'FIXED_AMOUNT', percentOff: null, amountIdr: 5_000_000 }),
      sessionRedemptions: 0,
    };
    const pricing = priceOrder([line(95_000)], 15_000, voucher, NOW);

    expect(pricing.discountIdr).toBe(95_000);
    expect(pricing.totalIdr).toBe(15_000);
  });

  it('keeps every figure an integer', () => {
    const voucher = { terms: voucherTerms({ percentOff: 33 }), sessionRedemptions: 0 };
    const pricing = priceOrder([line(99_999, 3)], 22_000, voucher, NOW);

    for (const value of [pricing.subtotalIdr, pricing.discountIdr, pricing.shippingIdr, pricing.totalIdr]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
