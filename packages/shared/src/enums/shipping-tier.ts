/**
 * Flat-rate courier tiers (FR-CO-04, PRD assumption A4). SAME_DAY is only offered where the
 * destination zone is eligible; the shipping service decides, not the client.
 */
export const SHIPPING_TIERS = ['REGULAR', 'EXPRESS', 'SAME_DAY'] as const;

export type ShippingTier = (typeof SHIPPING_TIERS)[number];
