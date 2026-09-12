import type { OrderStatus } from '@gunsnip/shared';
import type { StockEffect } from './order-transition.js';

/**
 * Which admin action may put an order into this status.
 *
 * `advance` is the generic status button. `payment` means the status is a consequence of the
 * charge settling and is reached through `POST /admin/orders/:orderNumber/payment`, which writes
 * the payment row too — moving an order to PAID without that would leave a paid order with an
 * unpaid charge. `cancel` has its own route because FR-ADM-08 makes the reason mandatory, and a
 * required field does not belong on a generic endpoint. `none` is reached only by the system.
 */
export type OperatorPath = 'advance' | 'payment' | 'cancel' | 'none';

export interface FulfilmentEffect {
  stock: StockEffect;
  operatorPath: OperatorPath;
  /** Shown when an operator tries to reach this status the wrong way. */
  wrongPathMessage?: string;
  /** The default `order_event` note when the operator leaves one out. */
  note: string;
  /** Stamps `shipment.shipped_at` as well as the order's status. */
  stampsShippedAt?: true;
  /** Stamps `order.delivered_at` and `shipment.delivered_at`. */
  stampsDeliveredAt?: true;
  /** A shipment with a courier has to exist first — you cannot dispatch to nowhere. */
  requiresShipment?: true;
}

/**
 * What each operator-driven status change does besides changing the status (FR-ADM-08).
 *
 * A table for the same reason `ORDER_TRANSITIONS` is a table: the alternative is a chain of
 * `if (status === 'SHIPPED')` inside the fulfilment service, which CLAUDE.md forbids and which
 * is exactly how dispatch ends up consuming stock in one code path and not another.
 *
 * `ORDER_TRANSITIONS` says whether a move is *legal*; this says what the move *costs*. They are
 * deliberately separate — one is the lifecycle, the other is its side effects, and a new status
 * has to answer both questions rather than inheriting an answer.
 *
 * Every status maps to an entry, terminal ones included, so adding a status to the enum without
 * deciding its effects is a compile error rather than a silent "does nothing".
 */
export const FULFILMENT_EFFECTS: Readonly<Record<OrderStatus, FulfilmentEffect>> = {
  PENDING_PAYMENT: {
    stock: 'hold',
    operatorPath: 'none',
    note: 'Awaiting payment.',
    wrongPathMessage: 'An order starts out awaiting payment; it cannot be moved back there.',
  },
  PAID: {
    stock: 'hold',
    operatorPath: 'payment',
    note: 'Payment received.',
    wrongPathMessage: 'An order becomes paid when its payment settles. Mark the payment paid instead.',
  },

  PACKING: { stock: 'hold', operatorPath: 'advance', note: 'Picking and packing started.' },

  // Dispatch: the goods physically leave, so this is where the reservation becomes a sale
  // (PRD §8.3) and where `units_sold` finally moves.
  SHIPPED: {
    stock: 'consume',
    operatorPath: 'advance',
    note: 'Handed to the courier.',
    stampsShippedAt: true,
    requiresShipment: true,
  },

  DELIVERED: { stock: 'hold', operatorPath: 'advance', note: 'Delivered.', stampsDeliveredAt: true },
  COMPLETED: { stock: 'hold', operatorPath: 'advance', note: 'Order completed.' },

  // Both give the reservation back.
  CANCELLED: {
    stock: 'release',
    operatorPath: 'cancel',
    note: 'Cancelled by the shop.',
    wrongPathMessage: 'Cancelling needs a reason — use the cancel action.',
  },
  EXPIRED: {
    stock: 'release',
    operatorPath: 'none',
    note: 'Payment window closed.',
    wrongPathMessage: 'An order expires when its payment window closes; the sweep does that, not an operator.',
  },

  // The goods already shipped and their stock was already consumed. A refund is money moving,
  // not stock: whether anything comes back is a physical return, and a return is a RESTOCK
  // adjustment an operator makes when the parcel actually arrives (FR-ADM-05).
  REFUNDED: { stock: 'hold', operatorPath: 'advance', note: 'Refunded.' },
};
