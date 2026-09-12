import type { ShippingTier, ShippingZone } from '@gunsnip/shared';

/**
 * What delivery will probably cost, before there is an address to quote against (FR-CART-05).
 *
 * The cart has no destination yet — that arrives at checkout — so it shows the cheapest regular
 * rate the store offers and says which one it is. A lower bound the customer can read is honest;
 * a blended average would be a number that is true for nobody.
 */
export interface ShippingEstimate {
  zone: ShippingZone;
  tier: ShippingTier;
  /** Whole rupiah (PRD A2). */
  priceIdr: number;
  minDays: number;
  maxDays: number;
}
