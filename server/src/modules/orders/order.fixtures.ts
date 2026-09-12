import type { VoucherTerms } from '../vouchers/entities/voucher-terms.entity.js';
import type { Basket, BasketLine } from './entities/basket.entity.js';

/**
 * Builders for the order module's unit specs, colocated with them because the unit suite lives
 * beside the code (vitest.config.ts). Only `*.spec.ts` files import this, and `tsconfig.build.json`
 * excludes `*.fixtures.ts` so it never reaches `dist`.
 */
export const NOW = new Date('2026-09-11T05:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

export function basketLine(overrides: Partial<BasketLine> = {}): BasketLine {
  return {
    cartLineId: `line-${overrides.variantId ?? 'exia'}`,
    requestedQuantity: 1,
    priceAtAddIdr: overrides.unitPriceIdr ?? 785_000,
    bundle: null,
    variantId: 'exia',
    sku: 'MG-EXIA',
    variantName: null,
    unitPriceIdr: 785_000,
    stockOnHand: 8,
    stockReserved: 0,
    isSellable: true,
    productId: 'product-exia',
    productName: 'MG 1/100 Gundam Exia',
    productSlug: 'mg-1-100-gundam-exia',
    categoryIds: ['cat-kits-mg', 'cat-kits'],
    image: null,
    ...overrides,
  };
}

export function basket(lines: readonly BasketLine[], voucher: Basket['voucher'] = null): Basket {
  return { cartId: 'cart-1', lines, voucher };
}

export function voucherTerms(overrides: Partial<VoucherTerms> = {}): VoucherTerms {
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
