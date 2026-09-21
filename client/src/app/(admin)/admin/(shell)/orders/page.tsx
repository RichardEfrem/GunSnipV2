import { ORDER_STATUSES } from '@gunsnip/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchOrders } from '@/features/admin/api';
import { AdminListFilters } from '@/features/admin/components/AdminListFilters';
import { AdminPageHeader, AdminPanel, AdminTable, Td, Th } from '@/features/admin/components/AdminPanel';
import { CursorPager } from '@/features/admin/components/CursorPager';
import { OrderStatusBadge } from '@/features/admin/components/OrderStatusBadge';
import { ApiError } from '@/lib/api-error';
import { formatDateTime, formatIdr } from '@/lib/formatters';
import { ORDER_STATUS_LABELS } from '@/lib/labels';
import type { AdminOrderSummary, CursorPage } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Orders' };

/**
 * The order list (FR-ADM-07): filter by status and date, search by number or email.
 *
 * The URL is the state, like every other admin list — so "unpaid orders from last week" is a
 * link an operator can send to a colleague.
 */
export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  const params = await searchParams;
  const query = {
    status: single(params.status),
    q: single(params.q),
    placedFrom: toInstant(single(params.placedFrom), 'start'),
    placedTo: toInstant(single(params.placedTo), 'end'),
    cursor: single(params.cursor),
  };

  let page: CursorPage<AdminOrderSummary>;

  try {
    page = await fetchOrders(query);
  } catch (error) {
    return (
      <>
        <AdminPageHeader title="Orders" />
        <ErrorState
          title="The order list didn't load"
          description={error instanceof ApiError ? error.message : "The API didn't respond. Try again in a moment."}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Orders" description="Newest first." />

      <AdminListFilters
        basePath="/admin/orders"
        search={{ name: 'q', label: 'Search', placeholder: 'Order number or email', value: query.q }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: single(params.status),
            options: ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
          },
        ]}
        dates={[
          { name: 'placedFrom', label: 'Placed from', value: single(params.placedFrom) },
          { name: 'placedTo', label: 'Placed to', value: single(params.placedTo) },
        ]}
      />

      <AdminPanel isFlush className="mt-4">
        {page.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-frame-300">
            No orders match those filters. Clear the search to see everything.
          </p>
        ) : (
          <AdminTable className="min-w-[48rem]">
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th>Customer</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Total</Th>
                <Th>Placed</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((order) => (
                <tr key={order.orderNumber}>
                  <Td>
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="reticle rounded-sm font-mono text-xs text-core-blue underline-offset-2 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                  <Td className="min-w-0">
                    <div className="truncate">{order.customerName}</div>
                    <div className="truncate text-xs text-frame-300">{order.customerEmail}</div>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">{order.itemCount}</Td>
                  <Td className="whitespace-nowrap text-right font-mono tabular-nums">{formatIdr(order.totalIdr)}</Td>
                  <Td className="whitespace-nowrap text-xs text-frame-300">{formatDateTime(order.placedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>

      <CursorPager basePath="/admin/orders" params={params} nextCursor={page.nextCursor} />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * A `yyyy-mm-dd` from a date input to the instant the API filters on.
 *
 * The operator means the store's day, so the boundaries are Jakarta's midnights — "placed to
 * 12 September" has to include an order placed at 23:00 WIB that evening, which a naive UTC
 * midnight would cut off seven hours early. WIB is UTC+7 year round.
 */
function toInstant(day: string | undefined, edge: 'start' | 'end'): string | undefined {
  if (day === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;

  return new Date(`${day}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+07:00`).toISOString();
}
