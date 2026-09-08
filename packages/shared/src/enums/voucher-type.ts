/** Voucher kinds (FR-PROMO-01). One voucher per order in v1 (FR-PROMO-05). */
export const VOUCHER_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;

export type VoucherType = (typeof VOUCHER_TYPES)[number];
