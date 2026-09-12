import type { ReactNode } from 'react';
import { formatDeliveryPromise, formatIdr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, SHIPPING_TIER_LABELS } from '@/lib/labels';
import { orderProgress } from '../order-progress';
import type { Order } from '../schema';

/**
 * The totals breakdown, payment and delivery (FR-ORD-03) — every figure as the order recorded it.
 * `action` is where the cancel button goes when the order can still be cancelled.
 */
export function OrderSummaryPanel({ order, action }: { order: Order; action?: ReactNode }) {
  const { totals, payment, delivery } = order;
  // A buyer cancelling does not fail the charge — it simply goes unpaid, and the expiry sweep
  // closes it minutes later (FR-PAY-06). Until it does, the row still reads PENDING, and
  // "Awaiting payment" beside "Cancelled" would invite a customer to pay for nothing.
  const hasEndedUnpaid = orderProgress(order).ending !== null && payment?.status === 'PENDING';

  return (
    <section aria-labelledby="order-totals" className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4">
      <h2 id="order-totals" className="text-lg">
        Summary
      </h2>

      <dl className="flex flex-col gap-2 text-sm tabular-nums">
        <Row label="Subtotal" value={formatIdr(totals.subtotalIdr)} />
        {totals.discountIdr === 0 ? null : (
          <Row label={order.voucherCode === null ? 'Discount' : `Voucher ${order.voucherCode}`} value={`− ${formatIdr(totals.discountIdr)}`} />
        )}
        <Row label={`Shipping · ${SHIPPING_TIER_LABELS[delivery.tier]}`} value={formatIdr(totals.shippingIdr)} />
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-armor-150 pt-3">
          <dt className="font-display text-base font-semibold">Total</dt>
          <dd className="font-display text-2xl font-semibold text-sortie-red">{formatIdr(totals.totalIdr)}</dd>
        </div>
      </dl>

      <dl className="flex flex-col gap-2 border-t border-armor-150 pt-4 text-sm">
        {payment === null ? null : (
          <>
            <Row label="Payment" value={PAYMENT_METHOD_LABELS[payment.method]} />
            <Row label="Payment status" value={hasEndedUnpaid ? 'No payment taken' : PAYMENT_STATUS_LABELS[payment.status]} />
          </>
        )}
        <Row label="Delivery" value={formatDeliveryPromise(delivery.minDays, delivery.maxDays)} />
      </dl>

      {action}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-frame-300">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
