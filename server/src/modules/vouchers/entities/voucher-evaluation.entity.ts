import type { VoucherRejectionReason } from '@gunsnip/shared';

/**
 * The inputs and outcome of checking a voucher against a basket (FR-PROMO-02, FR-CART-06).
 */

/** One line the voucher could discount: only lines that count towards the total are passed. */
export interface VoucherBasketLine {
  productId: string;
  /** The product's own category and its parent, so a voucher scoped to "Kits" covers MG kits. */
  categoryIds: readonly string[];
  lineTotalIdr: number;
}

export interface VoucherBasket {
  lines: readonly VoucherBasketLine[];
  /** What free shipping would waive. Zero when there is nothing to ship. */
  shippingIdr: number;
}

/**
 * Why it failed, specifically enough to say what to do about it (FR-CART-06). Dates travel as
 * ISO strings and money as integers; the storefront words and formats both.
 */
export type VoucherRejection =
  | { reason: Exclude<VoucherRejectionReason, 'NOT_STARTED' | 'EXPIRED' | 'MIN_SPEND_NOT_MET'> }
  | { reason: 'NOT_STARTED'; startsAt: string }
  | { reason: 'EXPIRED'; endsAt: string }
  | { reason: 'MIN_SPEND_NOT_MET'; minSpendIdr: number; shortfallIdr: number };

export type VoucherEvaluation =
  | { isValid: true; discountIdr: number }
  | { isValid: false; rejection: VoucherRejection };
