'use client';

import { House, LayoutGrid, Menu, Package, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TAB_BAR_ITEMS, type TabIcon } from '@/lib/navigation';

const ICONS: Record<TabIcon, typeof House> = {
  home: House,
  shop: LayoutGrid,
  cart: ShoppingCart,
  orders: Package,
  more: Menu,
};

/**
 * The mobile tab bar (DESIGN.md §3.3). Frame, so --frame-900, and padded for the home
 * indicator so the last row of a list is never sitting under a thumb gesture.
 *
 * A Client Component only because the active tab depends on the current route.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="on-frame fixed inset-x-0 bottom-0 z-30 border-t border-frame-700 bg-frame-900 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {TAB_BAR_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'reticle flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-sm py-2 text-xs',
                  'transition-colors duration-fast ease-out',
                  isActive ? 'text-core-blue' : 'text-frame-muted hover:text-white',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
