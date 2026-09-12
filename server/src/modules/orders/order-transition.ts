import type { OrderStatus } from '@gunsnip/shared';
import { releaseStock } from '../inventory/stock-reservation.js';
import type { AuditActor } from './audit-actor.js';
import { assertOrderTransition } from './order-status-machine.js';
import type { OrderUnit } from './order-unit.js';

/**
 * Moves one order to a new status inside an open transaction, giving back whatever it was
 * holding (PRD §8.1, §8.3, FR-ORD-06).
 *
 * The single implementation of that sequence. Buyer cancellation (FR-ORD-04), payment failure
 * and the expiry sweep (FR-PAY-06) all reach a terminal status the same way and must all release
 * the same things; writing it three times is how one of them ends up not releasing the voucher.
 *
 * The order row is locked *first* and its status read from under the lock, so the transition is
 * checked against the status the last writer left rather than the one the caller read a moment
 * ago: two cancels racing, or a cancel racing an expiry, and exactly one of them wins.
 */
export interface OrderTransition {
  to: OrderStatus;
  by: AuditActor;
  note: string;
  cancelReason?: string;
  /**
   * The order never happened: release its reserved stock and its voucher use. Never true for a
   * status the order reaches by going forward.
   */
  isAbandoned: boolean;
  /** Stamped on the order when the payment settles it. */
  paidAt?: Date;
}

export async function transitionOrder(
  unit: OrderUnit,
  orderId: string,
  transition: OrderTransition,
): Promise<OrderStatus> {
  const order = await unit.lockOrder(orderId);
  const to = assertOrderTransition(order.status, transition.to);

  if (transition.isAbandoned) {
    const stock = await unit.lockVariants(order.items.map((item) => item.variantId));

    for (const item of order.items) {
      const level = stock.get(item.variantId);
      if (level !== undefined) stock.set(item.variantId, releaseStock(level, item.quantity));
    }

    await unit.writeStockLevels([...stock.values()]);
  }

  await unit.changeStatus(orderId, {
    from: order.status,
    to,
    by: transition.by,
    note: transition.note,
    cancelReason: transition.cancelReason,
    paidAt: transition.paidAt,
  });

  if (transition.isAbandoned && order.redeemedVoucherId !== null) {
    await unit.releaseVoucher(orderId, order.redeemedVoucherId);
  }

  return to;
}
