'use client';

import {
  ClipboardList,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Package,
  Store,
  Tags,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The back-office navigation (DESIGN.md §2.1 — the admin sidebar is `--frame-700`).
 *
 * A Client Component only because it needs `usePathname` to mark the current section. Everything
 * it renders is static, and the badge counts are passed in as props from the server rather than
 * fetched here (CLAUDE.md: components receive data as props and render).
 */
interface AdminSidebarProps {
  /** The pending-review count. Absent when it could not be read — a badge is not worth a failure. */
  pendingReviews?: number;
  onNavigate?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** The dashboard is every admin path's prefix, so it alone matches exactly. */
  isExact?: true;
  badge?: number;
}

export function AdminSidebar({ pendingReviews, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="size-4" aria-hidden />, isExact: true },
    { href: '/admin/orders', label: 'Orders', icon: <ClipboardList className="size-4" aria-hidden /> },
    { href: '/admin/products', label: 'Products', icon: <Package className="size-4" aria-hidden /> },
    {
      href: '/admin/reviews',
      label: 'Reviews',
      icon: <MessageSquare className="size-4" aria-hidden />,
      badge: pendingReviews,
    },
    { href: '/admin/vouchers', label: 'Vouchers', icon: <Ticket className="size-4" aria-hidden /> },
    { href: '/admin/banners', label: 'Banners', icon: <ImageIcon className="size-4" aria-hidden /> },
    { href: '/admin/reference', label: 'Reference data', icon: <Tags className="size-4" aria-hidden /> },
  ];

  return (
    <nav aria-label="Back office" className="flex h-full flex-col gap-1 p-3">
      {items.map((item) => {
        const isCurrent =
          item.isExact === true ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            // `aria-current` rather than colour alone — DESIGN.md §6 forbids colour as the only
            // signal, and this is the one that tells a screen reader where it is.
            aria-current={isCurrent ? 'page' : undefined}
            className={cn(
              'reticle flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-frame-muted',
              'transition-colors duration-fast ease-out hover:bg-frame-500/40 hover:text-white',
              isCurrent && 'bg-frame-500/60 font-medium text-white',
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>

            {item.badge !== undefined && item.badge > 0 ? (
              <span className="rounded-full bg-sortie-red px-2 py-0.5 font-mono text-xs text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}

      <Link
        href="/"
        className="reticle mt-auto flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-frame-muted transition-colors duration-fast ease-out hover:bg-frame-500/40 hover:text-white"
      >
        <Store className="size-4" aria-hidden />
        View storefront
      </Link>
    </nav>
  );
}
