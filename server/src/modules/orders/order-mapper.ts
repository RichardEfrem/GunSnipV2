import { canTransitionOrder } from './order-status-machine.js';
import { customerSnapshotSchema } from './entities/customer-snapshot.js';
import type { OrderPayment, OrderView } from './entities/order.entity.js';
import { paymentInstructionsSchema } from '../payments/entities/payment-instructions.schema.js';
import type { OrderRecord } from './order.repository.js';

/**
 * An order row to the shape the confirmation and detail pages render (FR-CO-09, FR-ORD-03).
 *
 * Reads only the snapshot columns (FR-ORD-05). The customer snapshot is parsed rather than cast:
 * it comes out of JSONB as `unknown`, and a row that does not match is corruption worth a loud
 * 500, not a page that renders "undefined" where an address should be.
 */
export function toOrderView(record: OrderRecord): OrderView {
  const customer = customerSnapshotSchema.parse(record.customerSnapshot);
  const { address } = customer;

  return {
    orderNumber: record.orderNumber,
    status: record.status,
    placedAt: record.placedAt.toISOString(),
    canCancel: canTransitionOrder(record.status, 'CANCELLED'),
    cancelReason: record.cancelReason,

    items: record.items.map((item) => ({
      id: item.id,
      productName: item.productNameSnapshot,
      variantName: item.variantNameSnapshot,
      sku: item.skuSnapshot,
      productSlug: item.productSlugSnapshot,
      imageUrl: item.imageUrlSnapshot,
      unitPriceIdr: item.unitPriceIdr,
      quantity: item.quantity,
      lineTotalIdr: item.lineTotalIdr,
    })),
    totals: {
      subtotalIdr: record.subtotalIdr,
      discountIdr: record.discountIdr,
      shippingIdr: record.shippingIdr,
      totalIdr: record.totalIdr,
    },
    voucherCode: record.redemption?.voucher.code ?? null,

    contact: { name: customer.name, email: customer.email, phone: customer.phone },
    address: {
      street: address.street,
      district: address.district,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      notes: record.customerNote,
    },
    delivery: { tier: record.shippingTier, minDays: record.shippingMinDays, maxDays: record.shippingMaxDays },
    payment: record.payment === null ? null : toPaymentView(record.payment),
    timeline: record.events.map((event) => ({
      status: event.toStatus,
      at: event.createdAt.toISOString(),
      note: event.note,
    })),
  };
}

/**
 * The payment, and its instructions only while they are worth following (FR-PAY-03).
 *
 * A settled, expired or failed charge keeps its instructions in the database — the log of what
 * the customer was told — but the page must not still be showing an account number to pay into.
 * Parsed rather than cast, like the customer snapshot, because JSONB comes back as `unknown`.
 */
function toPaymentView(payment: NonNullable<OrderRecord['payment']>): OrderPayment {
  const isPayable = payment.status === 'PENDING';

  return {
    method: payment.method,
    status: payment.status,
    amountIdr: payment.amountIdr,
    expiresAt: payment.expiresAt.toISOString(),
    instructions: isPayable ? paymentInstructionsSchema.parse(payment.instructions) : null,
  };
}
