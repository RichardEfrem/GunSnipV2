import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchCart } from '@/features/cart/api';
import { CartScreen } from '@/features/cart/components/CartScreen';
import type { Cart } from '@/features/cart/schema';
import { fetchHome, fetchProducts } from '@/features/catalog/api';
import { GradeShortcuts } from '@/features/catalog/components/GradeShortcuts';
import { ProductRail } from '@/features/catalog/components/ProductRail';

/**
 * The cart (FR-CART-01 … FR-CART-07, DESIGN.md §3.6).
 *
 * Read on the server with the visitor's session and handed to one client component that owns
 * the interaction. Every figure on the page came from the API; after any change the page is
 * re-rendered from the API again rather than patched in the browser.
 *
 * All four states (DESIGN.md §4.5): `loading.tsx` is the skeleton, and this file renders the
 * error, the empty cart, and the loaded one.
 */
export const metadata: Metadata = {
  title: 'Cart',
  // Per-visitor and meaningless to a crawler.
  robots: { index: false },
};

export default async function CartPage() {
  let cart: Cart;

  try {
    cart = await fetchCart();
  } catch {
    return (
      <div className="mx-auto max-w-content px-4 py-6 md:px-6">
        <ErrorState
          title="Couldn't load your cart"
          description="The store didn't respond. Nothing in your cart has been lost — try again in a moment."
          action={
            <Link href="/cart" className={buttonStyles('secondary')}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  if (cart.lines.length === 0) return <EmptyCart />;

  const { lineCount } = cart.totals;

  return (
    // Bottom padding clears the fixed mobile checkout bar, so the last line is never under it.
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pb-28 pt-6 md:px-6 lg:pb-6">
      <h1 className="text-3xl">
        Cart <span className="font-normal text-frame-300">({lineCount} {lineCount === 1 ? 'item' : 'items'})</span>
      </h1>

      <CartScreen cart={cart} />
    </div>
  );
}

/**
 * FR-CART-07: an empty cart links to the grade shortcuts and the best sellers — a reason and a
 * route out, never a dead end (DESIGN.md §4.5).
 *
 * The catalogue reads are best-effort. An empty cart with no rails beneath it is still a
 * correct page, so a catalogue failure here removes the rails rather than the page.
 */
async function EmptyCart() {
  const [home, bestSellers] = await Promise.allSettled([
    fetchHome(),
    fetchProducts('sort=best_selling&limit=10'),
  ]);

  return (
    <div className="flex flex-col gap-10 py-6">
      <div className="mx-auto w-full max-w-content px-4 md:px-6">
        <h1 className="sr-only">Cart</h1>
        <EmptyState
          title="Your cart is empty"
          description="Kits you add land here, with the tools they need to build. Start with a grade, or with what other builders are buying."
          action={
            <Link href="/kits" className={buttonStyles('secondary')}>
              Browse kits
            </Link>
          }
        />

        {home.status === 'fulfilled' ? (
          <GradeShortcuts grades={home.value.gradeShortcuts} className="flex justify-center" />
        ) : null}
      </div>

      {bestSellers.status === 'fulfilled' ? (
        <ProductRail title="Best sellers" products={bestSellers.value.items} href="/kits?sort=best_selling" />
      ) : null}
    </div>
  );
}
