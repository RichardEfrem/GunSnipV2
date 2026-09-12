import type { ReactNode } from 'react';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { fetchCart } from '@/features/cart/api';
import type { Cart } from '@/features/cart/schema';

/**
 * The storefront shell. Admin gets its own group and its own chrome (PRD §7), which is why
 * the header and tab bar live here rather than in the root layout.
 */
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const cart = await cartOrNull();

  return (
    // Reserves the fixed mobile tab bar's height so the footer is never underneath it. The bar
    // pads itself by the home-indicator inset, so the reservation has to include it too.
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main"
        className="reticle sr-only rounded-sm bg-armor-000 px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <SiteHeader cart={cart} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}

/**
 * The cart behind the header's badge and mini-cart drawer, or null when it cannot be read.
 *
 * Swallowed on purpose: the header is on every page, and an API blip must not turn the whole
 * storefront into an error boundary over a badge. A missing cart reads as an empty one, which
 * is the least wrong thing it could say — and the cart page, which cannot shrug the same
 * failure off, reports it properly.
 */
async function cartOrNull(): Promise<Cart | null> {
  try {
    return await fetchCart();
  } catch {
    return null;
  }
}
