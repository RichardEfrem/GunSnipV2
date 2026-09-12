import { describe, expect, it } from 'vitest';
import type { VoucherBasket, VoucherBasketLine } from './entities/voucher-evaluation.entity.js';
import type { VoucherTerms } from './entities/voucher-terms.entity.js';
import { evaluateVoucher, type VoucherUsage } from './voucher-rules.js';

/**
 * Voucher validation — a mandatory unit-test target (CLAUDE.md Testing).
 *
 * Each rule of FR-PROMO-02 gets a case that trips it and, where there is a boundary, a case
 * that sits exactly on it. The amounts are the seeded vouchers' amounts, so a failure here reads
 * as a sentence about a real code rather than about fixture data.
 */
const NOW = new Date('2026-09-11T05:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const MG_CATEGORY = 'cat-kits-mg';
const KITS_ROOT = 'cat-kits';
const NIPPER_CATEGORY = 'cat-tools-nippers';
const TOOLS_ROOT = 'cat-tools';

function terms(overrides: Partial<VoucherTerms> = {}): VoucherTerms {
  return {
    id: 'voucher-1',
    code: 'WELCOME10',
    type: 'PERCENTAGE',
    description: null,
    percentOff: 10,
    amountIdr: null,
    minSpendIdr: null,
    maxDiscountIdr: null,
    startsAt: new Date(NOW.getTime() - 30 * DAY_MS),
    endsAt: new Date(NOW.getTime() + 90 * DAY_MS),
    usageLimit: null,
    perSessionLimit: null,
    usedCount: 0,
    isActive: true,
    scope: { categoryIds: new Set(), productIds: new Set() },
    ...overrides,
  };
}

function kit(lineTotalIdr: number, productId = 'mg-exia'): VoucherBasketLine {
  return { productId, categoryIds: [MG_CATEGORY, KITS_ROOT], lineTotalIdr };
}

function nipper(lineTotalIdr: number): VoucherBasketLine {
  return { productId: 'god-hand-nipper', categoryIds: [NIPPER_CATEGORY, TOOLS_ROOT], lineTotalIdr };
}

function basket(lines: VoucherBasketLine[], shippingIdr = 15_000): VoucherBasket {
  return { lines, shippingIdr };
}

const FIRST_USE: VoucherUsage = { sessionRedemptions: 0 };

function evaluate(
  voucher: VoucherTerms,
  cart: VoucherBasket,
  usage: VoucherUsage = FIRST_USE,
  now: Date = NOW,
) {
  return evaluateVoucher(voucher, cart, usage, now);
}

describe('voucher rules', () => {
  describe('percentage', () => {
    it('takes the percentage off the subtotal', () => {
      expect(evaluate(terms(), basket([kit(400_000)]))).toEqual({ isValid: true, discountIdr: 40_000 });
    });

    it('rounds down, so the store never gives more than the stated percentage', () => {
      const result = evaluate(terms(), basket([kit(333_339)]));

      expect(result).toEqual({ isValid: true, discountIdr: 33_333 });
    });

    it('stops at the maximum discount cap (WELCOME10: 10% up to Rp 100.000)', () => {
      const result = evaluate(terms({ maxDiscountIdr: 100_000 }), basket([kit(2_000_000)]));

      expect(result).toEqual({ isValid: true, discountIdr: 100_000 });
    });

    it('can take everything at 100%, and never more', () => {
      const result = evaluate(terms({ percentOff: 100 }), basket([kit(250_000)]));

      expect(result).toEqual({ isValid: true, discountIdr: 250_000 });
    });
  });

  describe('fixed amount', () => {
    it('takes the amount off (FIRSTBUILD: Rp 50.000)', () => {
      const voucher = terms({ type: 'FIXED_AMOUNT', percentOff: null, amountIdr: 50_000 });

      expect(evaluate(voucher, basket([kit(400_000)]))).toEqual({ isValid: true, discountIdr: 50_000 });
    });

    it('never takes off more than the goods cost', () => {
      const voucher = terms({ type: 'FIXED_AMOUNT', percentOff: null, amountIdr: 50_000 });

      expect(evaluate(voucher, basket([nipper(30_000)]))).toEqual({ isValid: true, discountIdr: 30_000 });
    });
  });

  describe('free shipping', () => {
    const freeShipping = terms({ type: 'FREE_SHIPPING', percentOff: null });

    it('waives the whole shipping estimate when uncapped (GRATISONGKIR)', () => {
      expect(evaluate(freeShipping, basket([kit(600_000)], 22_000))).toEqual({
        isValid: true,
        discountIdr: 22_000,
      });
    });

    it('waives no more than its cap', () => {
      const capped = terms({ type: 'FREE_SHIPPING', percentOff: null, amountIdr: 20_000 });

      expect(evaluate(capped, basket([kit(600_000)], 35_000))).toEqual({
        isValid: true,
        discountIdr: 20_000,
      });
    });

    it('is still valid with nothing to waive, and takes nothing', () => {
      expect(evaluate(freeShipping, basket([kit(600_000)], 0))).toEqual({ isValid: true, discountIdr: 0 });
    });
  });

  describe('minimum spend', () => {
    const minimum = terms({ minSpendIdr: 250_000 });

    it('rejects below the minimum and says how much more is needed', () => {
      expect(evaluate(minimum, basket([kit(200_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'MIN_SPEND_NOT_MET', minSpendIdr: 250_000, shortfallIdr: 50_000 },
      });
    });

    it('accepts exactly the minimum', () => {
      expect(evaluate(minimum, basket([kit(250_000)])).isValid).toBe(true);
    });

    it('measures only what the voucher covers, not the whole cart', () => {
      const scopedMinimum = terms({
        minSpendIdr: 500_000,
        scope: { categoryIds: new Set([MG_CATEGORY]), productIds: new Set() },
      });

      // Rp 540.000 in the cart, but only Rp 490.000 of it is Master Grade.
      const result = evaluate(scopedMinimum, basket([kit(490_000), nipper(50_000)]));

      expect(result).toEqual({
        isValid: false,
        rejection: { reason: 'MIN_SPEND_NOT_MET', minSpendIdr: 500_000, shortfallIdr: 10_000 },
      });
    });
  });

  describe('scope', () => {
    it('discounts only the lines in scope (MASTERGRADE20)', () => {
      const mgOnly = terms({
        percentOff: 20,
        scope: { categoryIds: new Set([MG_CATEGORY]), productIds: new Set() },
      });

      const result = evaluate(mgOnly, basket([kit(500_000), nipper(385_000)]));

      expect(result).toEqual({ isValid: true, discountIdr: 100_000 });
    });

    it('covers a child category when scoped to its parent', () => {
      const allKits = terms({ scope: { categoryIds: new Set([KITS_ROOT]), productIds: new Set() } });

      expect(evaluate(allKits, basket([kit(300_000)]))).toEqual({ isValid: true, discountIdr: 30_000 });
    });

    it('matches a product named directly', () => {
      const oneKit = terms({ scope: { categoryIds: new Set(), productIds: new Set(['mg-exia']) } });

      const result = evaluate(oneKit, basket([kit(300_000, 'mg-exia'), kit(300_000, 'mg-unicorn')]));

      expect(result).toEqual({ isValid: true, discountIdr: 30_000 });
    });

    it('rejects a cart with nothing in scope', () => {
      const mgOnly = terms({ scope: { categoryIds: new Set([MG_CATEGORY]), productIds: new Set() } });

      expect(evaluate(mgOnly, basket([nipper(385_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'NO_ELIGIBLE_ITEMS' },
      });
    });
  });

  describe('availability', () => {
    it('rejects a voucher the operator switched off (STAFFONLY)', () => {
      expect(evaluate(terms({ isActive: false }), basket([kit(300_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'INACTIVE' },
      });
    });

    it('treats a percentage voucher with no percentage as unusable rather than as 0% off', () => {
      expect(evaluate(terms({ percentOff: null }), basket([kit(300_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'INACTIVE' },
      });
    });

    it('rejects before its window opens, with the start date', () => {
      const startsAt = new Date(NOW.getTime() + DAY_MS);

      expect(evaluate(terms({ startsAt }), basket([kit(300_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'NOT_STARTED', startsAt: startsAt.toISOString() },
      });
    });

    it('is valid from the instant it starts', () => {
      expect(evaluate(terms({ startsAt: NOW }), basket([kit(300_000)])).isValid).toBe(true);
    });

    it('rejects from the instant it ends, with the end date (LEBARAN2025)', () => {
      expect(evaluate(terms({ endsAt: NOW }), basket([kit(300_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'EXPIRED', endsAt: NOW.toISOString() },
      });
    });

    it('rejects once fully redeemed (FLASH50: 50 of 50)', () => {
      expect(evaluate(terms({ usageLimit: 50, usedCount: 50 }), basket([kit(1_200_000)]))).toEqual({
        isValid: false,
        rejection: { reason: 'USAGE_LIMIT_REACHED' },
      });
    });

    it('allows the last redemption', () => {
      expect(evaluate(terms({ usageLimit: 50, usedCount: 49 }), basket([kit(300_000)])).isValid).toBe(true);
    });

    it('rejects a second use by the same session (per-session limit of 1)', () => {
      const result = evaluate(terms({ perSessionLimit: 1 }), basket([kit(300_000)]), {
        sessionRedemptions: 1,
      });

      expect(result).toEqual({ isValid: false, rejection: { reason: 'SESSION_LIMIT_REACHED' } });
    });

    it('rejects a basket with nothing selected', () => {
      expect(evaluate(terms(), basket([]))).toEqual({
        isValid: false,
        rejection: { reason: 'NOTHING_SELECTED' },
      });
    });
  });

  it('reports an expiry ahead of a shortfall — the reason that cannot be fixed comes first', () => {
    const expiredAndTooSmall = terms({ endsAt: NOW, minSpendIdr: 1_000_000 });

    const result = evaluate(expiredAndTooSmall, basket([kit(100_000)]));

    expect(result.isValid === false && result.rejection.reason).toBe('EXPIRED');
  });

  it('only ever produces whole rupiah (CLAUDE.md non-negotiable #1)', () => {
    for (const percentOff of [1, 7, 13, 33, 99]) {
      const result = evaluate(terms({ percentOff }), basket([kit(123_457), nipper(98_761)]));

      expect(result.isValid && Number.isInteger(result.discountIdr)).toBe(true);
    }
  });
});
