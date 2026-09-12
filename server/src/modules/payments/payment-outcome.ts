import type { OrderStatus, PaymentStatus } from '@gunsnip/shared';

/**
 * The join between the two state machines (PRD §8.1, §8.2, §8.3): what a payment reaching a
 * status means for the order that owns it.
 *
 * Kept out of both machines and in its own file, because it is neither machine's rule — each one
 * only knows its own transitions. This is the one table that knows a payment reaching EXPIRED is
 * what makes an order EXPIRED, and that everything the order was holding goes back when it does.
 *
 * A **FAILED payment cancels the order.** PRD §8.1 gives the order no "failed" state, and §8.2
 * gives a failed payment no way back to PENDING — so an order left as it was could never be paid
 * and would hold its stock until the expiry job noticed. Cancelling says the same thing sooner.
 */
export interface PaymentOutcome {
  /** Where the order moves. */
  orderStatus: OrderStatus;
  /**
   * The order never happened: its reserved stock becomes available again and its voucher use is
   * given back (PRD §8.3, FR-PROMO-05). False for an order that was paid — a refunded order's
   * units left stock when it shipped, and putting them back is a receiving decision, not this one.
   */
  isAbandoned: boolean;
  /** Recorded on the `order_event` row (FR-ORD-06). */
  note: string;
  /** Shown to the customer on an order that will not be fulfilled. */
  cancelReason?: string;
}

const OUTCOMES: Readonly<Record<PaymentStatus, PaymentOutcome | null>> = {
  // The charge opening is not news to the order: it was created pending payment.
  PENDING: null,
  PAID: { orderStatus: 'PAID', isAbandoned: false, note: 'Payment received.' },
  FAILED: {
    orderStatus: 'CANCELLED',
    isAbandoned: true,
    note: 'Payment failed.',
    cancelReason: 'The payment did not go through.',
  },
  EXPIRED: {
    orderStatus: 'EXPIRED',
    isAbandoned: true,
    note: 'Payment window closed without payment.',
    cancelReason: 'The payment window closed before the order was paid.',
  },
  REFUNDED: { orderStatus: 'REFUNDED', isAbandoned: false, note: 'Payment refunded.' },
};

/** The order change a payment status implies, or null when it implies none. */
export function orderOutcomeOf(status: PaymentStatus): PaymentOutcome | null {
  return OUTCOMES[status];
}
