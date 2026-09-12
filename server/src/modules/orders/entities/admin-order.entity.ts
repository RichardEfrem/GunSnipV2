import type { ActorKind, OrderStatus, PaymentStatus } from '@gunsnip/shared';
import type { OrderView } from './order.entity.js';

/**
 * An order as the back office sees it (FR-ADM-07, FR-ADM-08).
 *
 * Extends the customer's view rather than replacing it, so the operator and the buyer are
 * looking at the same order — the snapshot lines, the totals and the timeline are literally the
 * same fields, and a discrepancy between the two screens is impossible by construction.
 *
 * What it adds is what only an operator may see: the internal note, who made each change, the
 * provider's reference for the charge, and the moves the state machine will actually accept from
 * here. That last one is why the screen never has to know PRD §8.1 — the buttons come from the
 * server, so an operator is never offered a transition that will be refused.
 */
export interface AdminOrderView extends Omit<OrderView, 'timeline'> {
  /** Never shown to the customer (FR-ADM-08). */
  internalNote: string | null;
  shipment: AdminShipment | null;
  /** The statuses this order may legally move to right now, in the map's order (PRD §8.1). */
  nextStatuses: readonly OrderStatus[];
  timeline: readonly AdminTimelineEntry[];
  /** The provider's own id for the charge — the mock's fake VA today (PRD §11.3). */
  paymentProviderRef: string | null;
  paymentStatus: PaymentStatus | null;
  /** The session the order was placed from. The one identifier a guest order has (PRD §11.1). */
  sessionId: string;
}

/** One row of the order list — enough to triage, not enough to fulfil. */
export interface AdminOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  totalIdr: number;
  /** ISO 8601, UTC. Formatted in Asia/Jakarta at the render layer (CLAUDE.md Conventions). */
  placedAt: string;
}

export interface AdminShipment {
  courier: string;
  trackingNumber: string | null;
  estimatedDays: number;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** The customer's timeline plus attribution — who moved it, which FR-ORD-06 records but hides. */
export interface AdminTimelineEntry {
  status: OrderStatus;
  at: string;
  note: string | null;
  actorKind: ActorKind;
  actorId: string | null;
}
