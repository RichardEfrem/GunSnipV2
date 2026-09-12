import { formatDeliveryDays } from '@/lib/formatters';
import { SHIPPING_ZONE_LABELS } from '@/lib/labels';
import type { ShippingEstimate } from './schema';

/**
 * The line under "Shipping (est.)" (FR-CART-05) — which rate the estimate is, so a lower bound
 * is never mistaken for a quote. Checkout replaces it with the real rate for the real address.
 */
export function shippingEstimateText(estimate: ShippingEstimate): string {
  return `Regular to ${SHIPPING_ZONE_LABELS[estimate.zone]}, ${formatDeliveryDays(estimate.minDays, estimate.maxDays)}. Exact cost at checkout.`;
}
