'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';

/**
 * The back-office chrome: a fixed sidebar on desktop, a drawer on mobile (DESIGN.md §2.1).
 *
 * A Client Component because the mobile drawer is the one piece of state the shell owns. The
 * pages inside it are Server Components — `children` arrives already rendered, so wrapping the
 * app in this costs nothing at the leaves.
 */
interface AdminShellProps {
  pendingReviews?: number;
  signOut: ReactNode;
  children: ReactNode;
}

export function AdminShell({ pendingReviews, signOut, children }: AdminShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-armor-050">
      {/* Desktop: always there, so the operator never loses their place in a long table. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-frame-700 lg:flex">
        <Brand />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminSidebar pendingReviews={pendingReviews} />
        </div>
        <div className="border-t border-frame-500 p-3">{signOut}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-frame-900 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-expanded={isDrawerOpen}
            aria-controls="admin-drawer"
            className="reticle rounded-sm p-2 text-frame-muted hover:text-white"
          >
            <Menu className="size-5" aria-hidden />
            <span className="sr-only">Open the back-office menu</span>
          </button>
          <Link href="/admin" className="reticle rounded-sm font-display text-sm font-semibold tracking-wide text-white">
            GUNSNIP ADMIN
          </Link>
        </header>

        {isDrawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close the menu"
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/60"
            />
            <div id="admin-drawer" className="absolute inset-y-0 left-0 flex w-64 flex-col bg-frame-700">
              <div className="flex items-center justify-between pr-2">
                <Brand />
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="reticle rounded-sm p-2 text-frame-muted hover:text-white"
                >
                  <X className="size-5" aria-hidden />
                  <span className="sr-only">Close the menu</span>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <AdminSidebar pendingReviews={pendingReviews} onNavigate={() => setIsDrawerOpen(false)} />
              </div>
              <div className="border-t border-frame-500 p-3">{signOut}</div>
            </div>
          </div>
        ) : null}

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-5 py-4">
      <Link href="/admin" className="reticle rounded-sm font-display text-sm font-semibold tracking-wide text-white">
        GUNSNIP ADMIN
      </Link>
    </div>
  );
}
