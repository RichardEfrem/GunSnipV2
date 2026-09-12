import type { OrderStatus } from '@gunsnip/shared';
import { consumeStock } from '../inventory/stock-fulfilment.js';
import { releaseStock } from '../inventory/stock-reservation.js';
import type { AuditActor } from './audit-actor.js';
import { assertOrderTransition } from './order-status-machine.js';
import type { OrderUnit } from './order-unit.js';

/**
 * What this transition does to the stock the order holds (PRD §8.3).
 *
 * Three named outcomes rather than a pair of booleans, because they are mutually exclusive and
 * a transition that both released and consumed its stock would be nonsense the type system
 * should not allow anyone to write.
 *
 * - `hold`    — nothing moves. The order is still going forward and still holds its reservation.
 * - `release` — the order never happened: give the reservation and the voucher use back.
 * - `consume` — the goods shipped: both counters drop and an `ORDER_FULFILLED` movement records it.
 */
export type StockEffect = 'hold' | 'release' | 'consume';

export interface OrderTransition {
  to: OrderStatus;
  by: AuditActor;
  note: string;
  cancelReason?: string;
  stock: StockEffect;
  /** Stamped on the order when the payment settles it. */
  paidAt?: Date;
  /** Stamped when the order is marked delivered, so the review invite has a date to work from. */
  deliveredAt?: Date;
}

/**
 * Moves one order to a new status inside an open transaction, giving back whatever it was
 * holding (PRD §8.1, §8.3, FR-ORD-06).
 *
 * The single implementation of that sequence. Buyer cancellation (FR-ORD-04), payment failure,
 * the expiry sweep (FR-PAY-06) and operator fulfilment (FR-ADM-08) all move an order the same
 * way and must all settle the same things; writing it four times is how one of them ends up not
 * releasing the voucher.
 *
 * The order row is locked *first* and its status read from under the lock, so the transition is
 * checked against the status the last writer left rather than the one the caller read a moment
 * ago: two cancels racing, or a cancel racing an expiry, and exactly one of them wins.
 */
export async function transitionOrder(
  unit: OrderUnit,
  orderId: string,
  transition: OrderTransition,
): Promise<OrderStatus> {
  const order = await unit.lockOrder(orderId);
  const to = assertOrderTransition(order.status, transition.to);

  if (transition.stock !== 'hold') {
    const stock = await unit.lockVariants(order.items.map((item) => item.variantId));

    for (const item of order.items) {
      const level = stock.get(item.variantId);
      if (level === undefined) continue;

      stock.set(
        item.variantId,
        transition.stock === 'release'
          ? releaseStock(level, item.quantity)
          : consumeStock(level, item.quantity),
      );
    }

    await unit.writeStockLevels([...stock.values()]);

    // Dispatch is the one transition where stock leaves rather than being given back, so it is
    // the one that owes the audit trail a row (PRD §8.3) and the catalogue its sales counter.
    if (transition.stock === 'consume') {
      await unit.recordFulfilment(orderId, order.items, transition.by);
    }
  }

  await unit.changeStatus(orderId, {
    from: order.status,
    to,
    by: transition.by,
    note: transition.note,
    cancelReason: transition.cancelReason,
    paidAt: transition.paidAt,
    deliveredAt: transition.deliveredAt,
  });

  if (transition.stock === 'release' && order.redeemedVoucherId !== null) {
    await unit.releaseVoucher(orderId, order.redeemedVoucherId);
  }

  return to;
}
