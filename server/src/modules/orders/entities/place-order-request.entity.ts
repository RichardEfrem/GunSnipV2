import type { PaymentMethod, ShippingTier } from '@gunsnip/shared';
import type { RequestedLine } from '../order-lines.js';

/**
 * What the placement service needs from a `POST /orders` body — the shape `PlaceOrderDto`
 * validates, as a plain interface so the service does not depend on the validation classes.
 */
export interface PlaceOrderRequest {
  contact: { name: string; email: string; phone: string };
  address: { regionId: string; postalCode: string; street: string; notes?: string };
  shippingTier: ShippingTier;
  paymentMethod: PaymentMethod;
  items: readonly RequestedLine[];
  /** What the summary showed. Compared, never charged. */
  expectedTotalIdr: number;
}
