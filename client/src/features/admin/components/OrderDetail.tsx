import { formatDateTime, formatDeliveryDays, formatIdr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, SHIPPING_TIER_LABELS } from '@/lib/labels';
import type { AdminOrder } from '../schema';
import { AdminPanel, AdminTable, Td, Th } from './AdminPanel';
import { OrderFulfilmentControls } from './OrderFulfilmentControls';
import { OrderInternalNote } from './OrderInternalNote';
import { OrderShipmentForm } from './OrderShipmentForm';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderTimeline } from './OrderTimeline';

/**
 * One order, as an operator works it (FR-ADM-08).
 *
 * A Server Component: the lines, the address and the timeline are text, and only the three
 * panels that actually change something are Client Components. That is the rule CLAUDE.md sets —
 * push `'use client'` as far down as possible — and here it means a fulfilment screen ships
 * JavaScript for its buttons and nothing else.
 */
export function OrderDetail({ order }: { order: AdminOrder }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <AdminPanel title="Items" isFlush>
          <AdminTable className="min-w-[36rem]">
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Unit price</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Line total</Th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <div className="font-medium">{item.productName}</div>
                    <div className="mt-0.5 font-mono text-xs text-frame-300">
                      {item.sku}
                      {item.variantName === null ? '' : ` · ${item.variantName}`}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums">
                    {formatIdr(item.unitPriceIdr)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{item.quantity}</Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums">
                    {formatIdr(item.lineTotalIdr)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>

          <dl className="flex flex-col gap-1.5 border-t border-armor-150 p-4 text-sm">
            <Total term="Subtotal" value={formatIdr(order.totals.subtotalIdr)} />
            {order.totals.discountIdr > 0 ? (
              <Total
                term={order.voucherCode === null ? 'Discount' : `Discount (${order.voucherCode})`}
                value={`−${formatIdr(order.totals.discountIdr)}`}
              />
            ) : null}
            <Total term="Shipping" value={formatIdr(order.totals.shippingIdr)} />
            <Total term="Total" value={formatIdr(order.totals.totalIdr)} isStrong />
          </dl>
        </AdminPanel>

        <div className="grid gap-5 md:grid-cols-2">
          <AdminPanel title="Deliver to">
            <address className="not-italic text-sm leading-relaxed">
              <div className="font-medium">{order.contact.name}</div>
              <div className="text-frame-300">{order.contact.phone}</div>
              <div className="mt-2">{order.address.street}</div>
              <div>
                {[order.address.district, order.address.city, order.address.province]
                  .filter((part): part is string => part !== null)
                  .join(', ')}
              </div>
              <div className="font-mono text-xs">{order.address.postalCode}</div>
            </address>

            {order.address.notes === null ? null : (
              <p className="mt-3 rounded-sm bg-armor-050 p-2 text-xs">
                <span className="font-medium">Customer note: </span>
                {order.address.notes}
              </p>
            )}
          </AdminPanel>

          <AdminPanel title="Payment and delivery">
            <dl className="flex flex-col gap-2 text-sm">
              <Row term="Payment">
                {order.payment === null
                  ? '—'
                  : `${PAYMENT_METHOD_LABELS[order.payment.method]} · ${PAYMENT_STATUS_LABELS[order.payment.status]}`}
              </Row>
              {order.paymentProviderRef === null ? null : (
                <Row term="Provider reference">{order.paymentProviderRef}</Row>
              )}
              <Row term="Courier tier">
                {`${SHIPPING_TIER_LABELS[order.delivery.tier]} · ${formatDeliveryDays(
                  order.delivery.minDays,
                  order.delivery.maxDays,
                )}`}
              </Row>
              <Row term="Placed">{formatDateTime(order.placedAt)}</Row>
              <Row term="Session">{order.sessionId}</Row>
            </dl>
          </AdminPanel>
        </div>

        <OrderShipmentForm order={order} />
        <OrderInternalNote order={order} />

        <AdminPanel title="History" description="Every status change, and who made it (FR-ORD-06).">
          <OrderTimeline timeline={order.timeline} />
        </AdminPanel>
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start">
        <AdminPanel title="Status">
          <div className="mb-4">
            <OrderStatusBadge status={order.status} />
            {order.cancelReason === null ? null : (
              <p className="mt-2 text-xs text-frame-300">{order.cancelReason}</p>
            )}
          </div>

          <OrderFulfilmentControls order={order} />
        </AdminPanel>
      </div>
    </div>
  );
}

function Total({ term, value, isStrong = false }: { term: string; value: string; isStrong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${isStrong ? 'border-t border-armor-150 pt-1.5' : ''}`}>
      <dt className={isStrong ? 'font-medium' : 'text-frame-300'}>{term}</dt>
      <dd className={`font-mono tabular-nums ${isStrong ? 'text-base font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}

function Row({ term, children }: { term: string; children: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-frame-300">{term}</dt>
      <dd className="truncate text-right font-mono text-xs">{children}</dd>
    </div>
  );
}
