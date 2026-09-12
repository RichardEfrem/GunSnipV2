/**
 * Why a voucher cannot be used (FR-CART-06, FR-PROMO-02).
 *
 * FR-CART-06 asks for "a clear reason for rejection", and a clear reason is a specific one:
 * "Spend Rp 50.000 more" tells a customer what to do, "Invalid voucher" does not. The server
 * decides the reason; the storefront words it, since several carry an amount or a date and both
 * are formatted only at the render layer (CLAUDE.md non-negotiable #1, Conventions).
 *
 * Listed in the order the rules are checked, which is also the order of usefulness: a voucher
 * that has expired should say so, not that the cart is below its minimum spend.
 */
export const VOUCHER_REJECTION_REASONS = [
  'NOT_FOUND',
  'INACTIVE',
  'NOT_STARTED',
  'EXPIRED',
  'USAGE_LIMIT_REACHED',
  'SESSION_LIMIT_REACHED',
  'NOTHING_SELECTED',
  'NO_ELIGIBLE_ITEMS',
  'MIN_SPEND_NOT_MET',
] as const;

export type VoucherRejectionReason = (typeof VOUCHER_REJECTION_REASONS)[number];
