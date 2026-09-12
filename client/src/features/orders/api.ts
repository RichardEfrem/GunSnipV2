import { ApiError } from '@/lib/api-error';
import { serverApiFetch } from '@/lib/api-server';
import { orderSchema, type Order } from './schema';

/**
 * One order, read on the server (FR-ORD-02, FR-ORD-03).
 *
 * Without an email the API shows the order only to the session that placed it — the confirmation
 * page right after checkout. With one, anyone holding the number and the email gets it: guest
 * lookup from another device. Null covers every way of not getting it, because the API answers
 * "not yours" and "no such order" identically on purpose, and the page should too.
 *
 * `no-store`: it is per-visitor, and its status changes.
 */
export async function fetchOrder(orderNumber: string, email: string | undefined): Promise<Order | null> {
  const query = email === undefined ? '' : `?email=${encodeURIComponent(email)}`;

  try {
    return await serverApiFetch(`/orders/${encodeURIComponent(orderNumber)}${query}`, {
      schema: orderSchema,
      cache: 'no-store',
    });
  } catch (cause) {
    // 400 is a malformed number or email — as unfindable as a wrong one.
    if (cause instanceof ApiError && (cause.isNotFound || cause.status === 400)) return null;
    throw cause;
  }
}
