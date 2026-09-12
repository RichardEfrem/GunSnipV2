import { apiFetch } from '@/lib/api-client';
import { orderSchema, type Order } from './schema';

/**
 * Buyer cancellation, from the browser (FR-ORD-04). The email is sent when the page was reached
 * through guest lookup, since that is what proved access; the placing session needs none.
 */
export async function cancelOrder(orderNumber: string, email: string | undefined): Promise<Order> {
  return apiFetch(`/orders/${encodeURIComponent(orderNumber)}/cancel`, {
    schema: orderSchema,
    method: 'POST',
    body: email === undefined ? {} : { email },
  });
}
