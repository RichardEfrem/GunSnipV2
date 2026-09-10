import { Heart } from 'lucide-react';
import Link from 'next/link';
import { PRIMARY_NAV } from '@/lib/navigation';
import { CartButton } from './CartButton';
import { HeaderShell } from './HeaderShell';
import { HeaderSearch } from './HeaderSearch';
import { NavDropdown } from './NavDropdown';

/**
 * Two rows on --frame-900 (DESIGN.md §4.1).
 *
 *   Row 1  wordmark · search · Stash · cart
 *   Row 2  Kits ▾ · Tools ▾ · Bundles · Guides · (right) Track order
 *
 * Row 2 is desktop-only — on mobile its job belongs to the tab bar (DESIGN.md §3.3), and
 * duplicating it would spend a third of a small screen on chrome.
 *
 * A Server Component. Only the three pieces that genuinely need the browser — scroll position,
 * the rotating placeholder, the dropdown panels — cross into client code.
 */
interface SiteHeaderProps {
  /** Wired to the cart in Phase 6; the badge and its animation exist now so that is a data
   *  change rather than a component change. */
  cartCount?: number;
}

export function SiteHeader({ cartCount = 0 }: SiteHeaderProps) {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 transition-[height] duration-base ease-out group-data-[collapsed=true]:h-14 md:gap-4 md:px-6">
        <Link
          href="/"
          className="reticle rounded-sm font-display text-xl font-semibold tracking-tight text-white"
        >
          GUNSNIP
        </Link>

        <HeaderSearch />

        <Link
          href="/stash"
          className="reticle hidden size-11 place-items-center rounded-sm text-white transition-colors duration-fast ease-out hover:text-core-blue sm:grid"
        >
          <Heart className="size-5" aria-hidden />
          <span className="sr-only">Stash</span>
        </Link>

        <CartButton count={cartCount} />
      </div>

      {/* Collapses to zero height past 200px of scroll rather than unmounting, so the
          transition has something to animate and the row does not snap back.

          `overflow-hidden` is applied only while collapsed. Left on permanently it clips
          anything leaving the row's 44px box — which is both the open dropdown panel and the
          focus reticle's corner brackets. */}
      <div className="hidden border-t border-frame-700 transition-[height] duration-base ease-out group-data-[collapsed=true]:h-0 group-data-[collapsed=true]:overflow-hidden md:block md:h-11">
        <nav aria-label="Primary" className="mx-auto flex h-11 max-w-content items-center gap-1 px-6">
          {PRIMARY_NAV.map((item) =>
            item.columns === undefined ? (
              <Link
                key={item.href}
                href={item.href}
                className="reticle flex h-10 items-center rounded-sm px-2 font-display text-sm font-semibold text-white transition-colors duration-fast ease-out hover:text-core-blue"
              >
                {item.label}
              </Link>
            ) : (
              <NavDropdown key={item.href} item={{ ...item, columns: item.columns }} />
            ),
          )}

          <Link
            href="/orders/track"
            className="reticle ml-auto flex h-10 items-center rounded-sm px-2 text-sm text-frame-muted transition-colors duration-fast ease-out hover:text-white"
          >
            Track order
          </Link>
        </nav>
      </div>
    </HeaderShell>
  );
}
