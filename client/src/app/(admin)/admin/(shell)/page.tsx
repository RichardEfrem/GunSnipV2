import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchDashboard } from '@/features/admin/api';
import { AdminPageHeader, AdminPanel, AdminTable, Td, Th } from '@/features/admin/components/AdminPanel';
import { OrderStatusBadge } from '@/features/admin/components/OrderStatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiError } from '@/lib/api-error';
import { formatCount, formatDateTime, formatIdr } from '@/lib/formatters';
import type { AdminDashboard } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The back office's front page (FR-ADM-01).
 *
 * Every figure here answers "is there something I have to do right now?", and every one of them
 * links to the screen where it gets done — a number an operator cannot act on is decoration.
 */
export default async function AdminDashboardPage() {
  let dashboard: AdminDashboard;

  try {
    dashboard = await fetchDashboard();
  } catch (error) {
    return (
      <ErrorState
        title="The dashboard didn't load"
        description={
          error instanceof ApiError
            ? error.message
            : "The API didn't respond. Nothing is wrong with your data — try again in a moment."
        }
      />
    );
  }

  const { today, queues, lowStock, topProducts, recentOrders } = dashboard;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Figures as of ${formatDateTime(dashboard.generatedAt)}, Jakarta time.`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Orders today" value={formatCount(today.orderCount)} href="/admin/orders" />
        <Stat label="Paid today" value={formatIdr(today.revenueIdr)} />
        <Stat
          label="Awaiting payment"
          value={formatCount(queues.awaitingPayment)}
          href="/admin/orders?status=PENDING_PAYMENT"
        />
        <Stat
          label="Awaiting shipment"
          value={formatCount(queues.awaitingShipment)}
          href="/admin/orders?status=PAID"
          tone={queues.awaitingShipment > 0 ? 'attention' : undefined}
        />
        <Stat
          label="Reviews to moderate"
          value={formatCount(queues.pendingReviews)}
          href="/admin/reviews"
          tone={queues.pendingReviews > 0 ? 'attention' : undefined}
        />
        <Stat
          label="Variants low on stock"
          value={formatCount(queues.lowStockCount)}
          tone={queues.lowStockCount > 0 ? 'warn' : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminPanel title="Recent orders" isFlush>
          {recentOrders.length === 0 ? (
            <Quiet>No orders yet. They will appear here the moment one is placed.</Quiet>
          ) : (
            <AdminTable className="min-w-[32rem]">
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.orderNumber}>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="reticle rounded-sm font-mono text-xs text-core-blue underline-offset-2 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <div className="mt-1">
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </Td>
                    <Td className="truncate">{order.customerName}</Td>
                    <Td className="text-right font-mono tabular-nums">{formatIdr(order.totalIdr)}</Td>
                    <Td className="whitespace-nowrap text-xs text-frame-300">{formatDateTime(order.placedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel title="Low stock" description="Published variants at or below the low-stock threshold." isFlush>
          {lowStock.length === 0 ? (
            <Quiet>Nothing is running low.</Quiet>
          ) : (
            <AdminTable className="min-w-[32rem]">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Available</Th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((line) => (
                  <tr key={line.variantId}>
                    <Td>
                      <Link
                        href={`/admin/products/${line.productId}`}
                        className="reticle rounded-sm text-core-blue underline-offset-2 hover:underline"
                      >
                        {line.productName}
                      </Link>
                      {line.variantName === null ? null : (
                        <span className="text-frame-300"> · {line.variantName}</span>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{line.sku}</Td>
                    <Td
                      className={`text-right font-mono tabular-nums ${
                        line.availableQuantity === 0 ? 'text-danger' : 'text-warn'
                      }`}
                    >
                      {line.availableQuantity}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel title="Best selling" isFlush className="xl:col-span-2">
          {topProducts.length === 0 ? (
            <Quiet>Nothing has sold yet.</Quiet>
          ) : (
            <AdminTable className="min-w-[32rem]">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">Units sold</Th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.productId}>
                    <Td>
                      <Link
                        href={`/admin/products/${product.productId}`}
                        className="reticle rounded-sm text-core-blue underline-offset-2 hover:underline"
                      >
                        {product.name}
                      </Link>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{formatCount(product.unitsSold)}</Td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>
      </div>
    </>
  );
}

/**
 * One figure. A tone only when the number means work is waiting — a stat that is always coloured
 * stops saying anything, so zero is deliberately plain.
 */
function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: 'attention' | 'warn';
}) {
  const body = (
    <>
      <span className="text-xs uppercase tracking-wide text-frame-300">{label}</span>
      <span
        className={`mt-1 block font-display text-2xl font-semibold tabular-nums ${
          tone === 'attention' ? 'text-core-blue' : tone === 'warn' ? 'text-warn' : ''
        }`}
      >
        {value}
      </span>
    </>
  );

  const className = 'block rounded-sm border border-armor-150 bg-armor-000 px-4 py-3';

  return href === undefined ? (
    <div className={className}>{body}</div>
  ) : (
    <Link href={href} className={`reticle ${className} transition-colors duration-fast ease-out hover:border-core-blue`}>
      {body}
    </Link>
  );
}

function Quiet({ children }: { children: string }) {
  return <p className="px-4 py-8 text-center text-sm text-frame-300">{children}</p>;
}
