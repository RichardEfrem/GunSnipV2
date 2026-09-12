import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchOrder } from '@/features/orders/api';
import { CancelOrderButton } from '@/features/orders/components/CancelOrderButton';
import { OrderAddress } from '@/features/orders/components/OrderAddress';
import { OrderHeader } from '@/features/orders/components/OrderHeader';
import { OrderItems } from '@/features/orders/components/OrderItems';
import { PaymentPanel } from '@/features/orders/components/PaymentPanel';
import { OrderSummaryPanel } from '@/features/orders/components/OrderSummaryPanel';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import type { Order } from '@/features/orders/schema';

/**
 * One order: the confirmation straight after checkout (FR-CO-09, DESIGN.md §3.8) and the order
 * detail a guest reaches by lookup (FR-ORD-02, FR-ORD-03) — the same page, because both need the
 * same things: the number, what to do next, the items, where it is going, and where it has got to.
 *
 * `?email=` is present only when the visitor came through lookup; the session that placed the
 * order needs none. Rendered on the server per request — the order is private and its status
 * moves.
 */
export async function generateMetadata({ params }: PageProps<'/orders/[orderNumber]'>): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber.toUpperCase()}`, robots: { index: false } };
}

export default async function OrderPage({ params, searchParams }: PageProps<'/orders/[orderNumber]'>) {
  const { orderNumber } = await params;
  const { email: emailParam } = await searchParams;
  const email = typeof emailParam === 'string' && emailParam.length > 0 ? emailParam : undefined;

  let order: Order | null;

  try {
    order = await fetchOrder(orderNumber.toUpperCase(), email);
  } catch {
    return (
      <div className="mx-auto max-w-content px-4 py-6 md:px-6">
        <ErrorState
          title="Couldn't load this order"
          description="The store didn't respond. Your order is unaffected — try again in a moment."
          action={
            <Link href={`/orders/${orderNumber}${email === undefined ? '' : `?email=${encodeURIComponent(email)}`}`} className={buttonStyles('secondary')}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="mx-auto max-w-content px-4 py-6 md:px-6">
        <EmptyState
          title="We couldn't find that order"
          description="Check the order number, and use the email you checked out with. Orders placed in this browser open without one."
          action={
            <Link href="/orders" className={buttonStyles('secondary')}>
              Look up an order
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-6 md:px-6">
      <OrderHeader order={order} />

      <div className="border border-armor-150 bg-armor-000 p-4 md:p-6">
        <OrderTimeline order={order} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {order.payment === null ? null : <PaymentPanel payment={order.payment} />}

          <section aria-labelledby="order-items" className="flex flex-col gap-3 border border-armor-150 bg-armor-000 p-4">
            <h2 id="order-items" className="text-lg">
              Items
            </h2>
            <OrderItems items={order.items} />
          </section>

          <OrderAddress order={order} />
        </div>

        <aside className="lg:sticky lg:top-20">
          <OrderSummaryPanel
            order={order}
            action={order.canCancel ? <CancelOrderButton orderNumber={order.orderNumber} email={email} /> : undefined}
          />
        </aside>
      </div>
    </div>
  );
}
