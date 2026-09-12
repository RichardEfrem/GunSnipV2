import type { PaymentStatus } from '@gunsnip/shared';
import { IllegalTransitionError } from '../../common/errors/illegal-transition.error.js';

/**
 * The payment lifecycle (PRD §8.2) as an explicit transition map — the payment half of what
 * `order-status-machine.ts` does for the order, and the only place that knows which payment
 * status may follow which.
 *
 *     PENDING ─▶ PAID ─▶ REFUNDED
 *        ├─▶ FAILED
 *        └─▶ EXPIRED
 *
 * Two machines rather than one, because they are driven by different things: the payment moves
 * because the provider says so, the order moves because the payment did or because an operator
 * acted. `paymentOutcome` below is the join between them — the one place a payment status is
 * turned into the order status it implies — so neither machine has to know the other's names.
 *
 * A failed charge deliberately has no way back to PENDING. The mock provider issues one charge
 * per order and a real gateway would issue a new one rather than reopen a dead one; letting a
 * FAILED payment become PENDING again would mean two charges sharing a row.
 */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  PENDING: ['PAID', 'FAILED', 'EXPIRED'],
  PAID: ['REFUNDED'],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Throws unless `from → to` is in the map. Returns `to`, so a caller can write the result directly. */
export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  if (!canTransitionPayment(from, to)) {
    throw new IllegalTransitionError('payment', from, to, illegalMessage(from, to));
  }

  return to;
}

/**
 * The sentence for the refusal a customer can actually cause: paying an order that has already
 * been settled, expired or refunded. The rest can only come from an operator or a bug.
 */
function illegalMessage(from: PaymentStatus, to: PaymentStatus): string | undefined {
  if (to !== 'PAID') return undefined;

  return from === 'PAID'
    ? 'This order has already been paid.'
    : 'This payment is closed and can no longer be paid. Place the order again.';
}
