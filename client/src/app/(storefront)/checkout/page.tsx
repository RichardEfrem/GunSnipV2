import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonStyles } from '@/components/ui/button-styles';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckoutScreen } from '@/features/checkout/components/CheckoutScreen';
import { readCheckoutDraft } from '@/features/checkout/draft-server';
import { loadCheckout, type CheckoutData } from '@/features/checkout/load-checkout';

/**
 * Checkout (FR-CO-01 … FR-CO-10, DESIGN.md §3.7).
 *
 * Rendered on the server with the visitor's saved draft already applied — the region lists for
 * their address and the quote for their tier are fetched here, so a refresh comes back exactly as
 * it was left (FR-CO-10) without the browser fetching anything to catch up. Guest checkout: no
 * account in the way (FR-CO-01).
 *
 * The four states (DESIGN.md §4.5): `loading.tsx` is the skeleton; an API failure is the error
 * state; an empty selection is not a checkout at all and goes back to the cart, whose empty state
 * is the designed one.
 */
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
};

export default async function CheckoutPage() {
  let data: CheckoutData;

  try {
    data = await loadCheckout(await readCheckoutDraft());
  } catch {
    return (
      <div className="mx-auto max-w-content px-4 py-6 md:px-6">
        <ErrorState
          title="Couldn't load checkout"
          description="The store didn't respond. Your cart is safe and nothing has been ordered — try again in a moment."
          action={
            <Link href="/checkout" className={buttonStyles('secondary')}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  if (data.quote.lines.length === 0) redirect('/cart');

  return (
    // Bottom padding clears the pinned mobile order bar, so the last section is never under it.
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pb-36 pt-6 md:px-6 lg:pb-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl">Checkout</h1>
        <Link href="/cart" className="reticle text-sm text-core-blue underline-offset-4 hover:underline">
          Back to cart
        </Link>
      </div>

      <CheckoutScreen
        quote={data.quote}
        draft={data.draft}
        provinces={data.provinces}
        cities={data.cities}
        districts={data.districts}
      />
    </div>
  );
}
