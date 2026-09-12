import type { ShippingTier } from '@gunsnip/shared';
import { apiFetch } from '@/lib/api-client';
import { serverApiFetch } from '@/lib/api-server';
import { checkoutQuoteSchema, regionListSchema, type CheckoutQuote, type Region } from './schema';

/**
 * Checkout reads, on the server (CLAUDE.md: no fetch calls in components).
 */

/** Reference data that changes when an operator edits the map — an hour is plenty fresh. */
const REGIONS_TTL_SECONDS = 60 * 60;

/** Provinces when `parentId` is null; otherwise one region's children (FR-CO-03). */
export async function fetchRegions(parentId: string | null): Promise<Region[]> {
  const query = parentId === null ? '' : `?parentId=${encodeURIComponent(parentId)}`;

  // Public and identical for every visitor, so no session is attached and the result is cached.
  return apiFetch(`/shipping/regions${query}`, {
    schema: regionListSchema,
    next: { revalidate: REGIONS_TTL_SECONDS, tags: ['regions'] },
  });
}

/**
 * The summary for the visitor's cart, to an address and tier. `no-store`: it is per-visitor, and
 * it is the price — a cached one would be a stale one.
 */
export async function fetchCheckoutQuote(request: {
  regionId: string | null;
  shippingTier: ShippingTier;
}): Promise<CheckoutQuote> {
  return serverApiFetch('/checkout/quote', {
    schema: checkoutQuoteSchema,
    method: 'POST',
    body: request.regionId === null ? {} : { regionId: request.regionId, shippingTier: request.shippingTier },
    cache: 'no-store',
  });
}
