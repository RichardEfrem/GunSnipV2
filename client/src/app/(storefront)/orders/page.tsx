import type { Metadata } from 'next';
import { TrackOrderForm } from '@/features/orders/components/TrackOrderForm';

/**
 * Track an order (FR-ORD-02): the header's "Track order" and the tab bar's "Orders" both land
 * here. Phase 1 adds the signed-in customer's order history above this form (FR-ORD-07); a guest
 * will still use the form.
 */
export const metadata: Metadata = {
  title: 'Track an order',
  robots: { index: false },
};

export default function TrackOrderPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Track an order</h1>
        <p className="text-sm text-frame-300">
          Enter your order number and the email you checked out with. No account needed.
        </p>
      </div>

      <div className="border border-armor-150 bg-armor-000 p-4 md:p-6">
        <TrackOrderForm />
      </div>
    </div>
  );
}
