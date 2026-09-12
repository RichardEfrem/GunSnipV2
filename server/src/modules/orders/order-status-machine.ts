import type { OrderStatus } from '@gunsnip/shared';
import { IllegalTransitionError } from '../../common/errors/illegal-transition.error.js';

/**
 * The order lifecycle (PRD §8.1) as an explicit transition map. **The only place that knows which
 * status may follow which** — CLAUDE.md forbids `if (order.status === …)` anywhere else, so a
 * service asks this file and an illegal move throws.
 *
 *     PENDING_PAYMENT ─▶ PAID ─▶ PACKING ─▶ SHIPPED ─▶ DELIVERED ─▶ COMPLETED
 *            │                                              │
 *            ├─▶ CANCELLED   (buyer or admin)                └─▶ REFUNDED
 *            └─▶ EXPIRED     (payment window lapsed)
 *
 * Written in full now, although Phase 7 only drives `PENDING_PAYMENT → CANCELLED`: buyer
 * cancellation needs the rule "only while awaiting payment" (FR-ORD-04), and that rule *is* this
 * map. Phase 8 (payment, expiry) and Phase 9 (admin fulfilment) use the rest without editing it.
 *
 * Terminal states map to an empty list rather than being absent, so adding a status to the enum
 * without deciding its exits is a compile error, not a silent dead end.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED', 'EXPIRED'],
  PAID: ['PACKING'],
  PACKING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Throws unless `from → to` is in the map. Returns `to`, so a caller can write the result directly. */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (!canTransitionOrder(from, to)) {
    throw new IllegalTransitionError('order', from, to, illegalMessage(from, to));
  }

  return to;
}

/**
 * The customer-facing sentence for the refusals a customer can actually cause. The rest can only
 * come from an operator or a bug, and the generic wording is fine for both.
 */
function illegalMessage(from: OrderStatus, to: OrderStatus): string | undefined {
  if (to === 'CANCELLED') {
    return from === 'CANCELLED'
      ? 'This order is already cancelled.'
      : 'This order can no longer be cancelled — it is past awaiting payment.';
  }

  return undefined;
}
