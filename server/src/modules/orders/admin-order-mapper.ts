import { customerSnapshotSchema } from './entities/customer-snapshot.js';
import type { AdminOrderSummary, AdminOrderView } from './entities/admin-order.entity.js';
import { toOrderView } from './order-mapper.js';
import { ORDER_TRANSITIONS } from './order-status-machine.js';
import type { AdminOrderRow, OrderRecord } from './order.repository.js';

/**
 * An order row to the back-office shape.
 *
 * Built *on top of* `toOrderView` rather than beside it: the lines, totals and address an
 * operator reads have to be the same snapshot the customer reads, and deriving them twice is how
 * a support call ends with two people looking at different numbers. What this adds is only what
 * the customer's view deliberately withholds.
 */
export function toAdminOrderView(record: OrderRecord): AdminOrderView {
  const view = toOrderView(record);

  return {
    ...view,
    internalNote: record.internalNote,
    shipment:
      record.shipment === null
        ? null
        : {
            courier: record.shipment.courier,
            trackingNumber: record.shipment.trackingNumber,
            estimatedDays: record.shipment.estimatedDays,
            shippedAt: record.shipment.shippedAt?.toISOString() ?? null,
            deliveredAt: record.shipment.deliveredAt?.toISOString() ?? null,
          },
    // Straight from the state machine (PRD §8.1), so the screen's buttons and the server's rules
    // can never disagree.
    nextStatuses: ORDER_TRANSITIONS[record.status],
    timeline: record.events.map((event) => ({
      status: event.toStatus,
      at: event.createdAt.toISOString(),
      note: event.note,
      actorKind: event.actorKind,
      actorId: event.actorId,
    })),
    paymentProviderRef: record.payment?.providerRef ?? null,
    paymentStatus: record.payment?.status ?? null,
    sessionId: record.sessionId,
  };
}

export function toAdminOrderSummary(row: AdminOrderRow): AdminOrderSummary {
  // Parsed rather than cast: JSONB comes back as `unknown`, and a row that does not match is
  // corruption worth failing on, not a list cell reading "undefined".
  const customer = customerSnapshotSchema.parse(row.customerSnapshot);

  return {
    orderNumber: row.orderNumber,
    status: row.status,
    paymentStatus: row.payment?.status ?? null,
    customerName: customer.name,
    customerEmail: customer.email,
    itemCount: row._count.items,
    totalIdr: row.totalIdr,
    placedAt: row.placedAt.toISOString(),
  };
}
