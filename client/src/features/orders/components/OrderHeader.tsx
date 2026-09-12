import { CircleCheck } from 'lucide-react';
import { formatDateTime, formatIdr } from '@/lib/formatters';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { orderProgress } from '../order-progress';
import type { Order } from '../schema';

/**
 * The top of the order page (DESIGN.md §3.8, FR-CO-09).
 *
 * An order awaiting payment is headed the way the confirmation is drawn — "Order placed!", the
 * one exclamation mark the site allows (DESIGN.md §5) — because whether the customer arrived from
 * checkout or from a lookup, what they need next is the same: pay, and by when. *How* to pay is
 * `PaymentPanel`, immediately below; this only states the amount and the deadline.
 */
export function OrderHeader({ order }: { order: Order }) {
  const { ending } = orderProgress(order);
  const isAwaitingPayment = order.status === 'PENDING_PAYMENT';

  return (
    <header className="flex flex-col items-start gap-2">
      {isAwaitingPayment ? (
        <p className="flex items-center gap-2 text-sm font-medium text-ok">
          <CircleCheck className="size-5" aria-hidden />
          Order received
        </p>
      ) : null}

      <h1 className="text-3xl">{isAwaitingPayment ? 'Order placed!' : ORDER_STATUS_LABELS[order.status]}</h1>
      <p className="font-mono text-base">{order.orderNumber}</p>

      {isAwaitingPayment && order.payment !== null ? (
        <p className="max-w-measure text-sm">
          Complete payment of <span className="font-semibold tabular-nums">{formatIdr(order.payment.amountIdr)}</span> by{' '}
          {PAYMENT_METHOD_LABELS[order.payment.method].toLowerCase()} before{' '}
          <span className="font-semibold">{formatDateTime(order.payment.expiresAt)}</span> WIB, or the order is
          cancelled and its items released.
        </p>
      ) : null}

      {ending === null ? null : (
        <p className="text-sm text-frame-300">
          {ORDER_STATUS_LABELS[ending.status]} on {formatDateTime(ending.at)} WIB.
          {order.cancelReason === null ? '' : ` ${order.cancelReason}`}
        </p>
      )}
    </header>
  );
}
