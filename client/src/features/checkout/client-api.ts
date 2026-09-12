import { IDEMPOTENCY_KEY_HEADER, type PaymentMethod, type ShippingTier } from '@gunsnip/shared';
import { orderSchema, type Order } from '@/features/orders/schema';
import { apiFetch } from '@/lib/api-client';

/**
 * Placing the order, from the browser (FR-CO-07). Separate from `api.ts`, which reaches for
 * `next/headers` and so cannot be in a Client Component's module graph.
 */
export interface PlaceOrderBody {
  contact: { name: string; email: string; phone: string };
  address: { regionId: string; postalCode: string; street: string; notes?: string };
  shippingTier: ShippingTier;
  paymentMethod: PaymentMethod;
  /** The lines the summary showed — variants and counts, never prices. */
  items: { variantId: string; quantity: number }[];
  /** The total the summary showed. The server compares it and never charges it. */
  expectedTotalIdr: number;
}

export async function placeOrder(body: PlaceOrderBody, idempotencyKey: string): Promise<Order> {
  return apiFetch('/orders', {
    schema: orderSchema,
    method: 'POST',
    body,
    headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
  });
}
