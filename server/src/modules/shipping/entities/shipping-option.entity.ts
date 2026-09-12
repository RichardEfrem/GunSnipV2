import type { ShippingTier, ShippingZone } from '@gunsnip/shared';

/** One delivery choice at checkout: "Regular · 2–3 days · Rp 22.000" (FR-CO-04). */
export interface ShippingOption {
  tier: ShippingTier;
  /** Whole rupiah (PRD A2). */
  priceIdr: number;
  minDays: number;
  maxDays: number;
}

/**
 * `POST /shipping/quote` (FR-CO-04): every tier offered to a destination's zone, cheapest first.
 * Same-day appears only where a courier actually offers it, because the rate table only has a
 * row there — an absent tier is unavailable, never free.
 */
export interface ShippingQuote {
  regionId: string;
  /** Null, with no options, when the region's province was seeded without a zone. */
  zone: ShippingZone | null;
  options: readonly ShippingOption[];
}
