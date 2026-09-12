import type { VoucherType } from '@gunsnip/shared';

/**
 * A voucher as the rules read it (FR-PROMO-01, FR-PROMO-02) — every constraint in one plain
 * object, so `evaluateVoucher` can be a pure function over it and be tested without a database.
 */
export interface VoucherTerms {
  id: string;
  code: string;
  type: VoucherType;
  description: string | null;

  /** PERCENTAGE only. 1–100. */
  percentOff: number | null;
  /** FIXED_AMOUNT: the amount off. FREE_SHIPPING: an optional cap on the shipping waived. */
  amountIdr: number | null;

  minSpendIdr: number | null;
  maxDiscountIdr: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  perSessionLimit: number | null;
  usedCount: number;
  isActive: boolean;

  /** Both empty means the whole catalogue. */
  scope: VoucherScope;
}

export interface VoucherScope {
  categoryIds: ReadonlySet<string>;
  productIds: ReadonlySet<string>;
}
