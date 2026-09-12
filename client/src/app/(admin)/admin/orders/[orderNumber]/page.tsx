import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchOrder } from '@/features/admin/api';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { OrderDetail } from '@/features/admin/components/OrderDetail';
import { ApiError } from '@/lib/api-error';

export const metadata: Metadata = { title: 'Order' };

/** Order detail and fulfilment (FR-ADM-08). */
export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[orderNumber]'>) {
  const { orderNumber } = await params;

  // Only the fetch is in the try. JSX is not rendered where it is constructed, so a catch around
  // it would not see a rendering error anyway — it would only swallow the one it was written for.
  let order: Awaited<ReturnType<typeof fetchOrder>>;

  try {
    order = await fetchOrder(orderNumber);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title={order.orderNumber}
        description={`${order.contact.name} · ${order.contact.email}`}
        action={
          <Link href="/admin/orders" className="reticle self-center rounded-sm text-sm text-core-blue hover:underline">
            Back to orders
          </Link>
        }
      />

      <OrderDetail order={order} />
    </>
  );
}
