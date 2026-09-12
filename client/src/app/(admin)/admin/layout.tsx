import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { fetchReviewCounts } from '@/features/admin/api';
import { AdminShell } from '@/features/admin/components/AdminShell';
import { SignOutButton } from '@/features/admin/components/SignOutButton';
import { isAdminSignedIn } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-error';

/**
 * The back-office shell (PRD §7).
 *
 * Its own route group with its own chrome, which is why the storefront's header and tab bar are
 * in `(storefront)/layout.tsx` rather than the root layout. An operator working an order list
 * does not want a mini-cart.
 *
 * `noindex` because a back office has no business in a search result, even a guarded one.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · GunSnip Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // `proxy.ts` has already redirected anyone without the cookie, so this is the case it cannot
  // see: a cookie that exists and is no longer accepted. Re-checked here because the layout is
  // the first thing that actually talks to the API.
  if (!(await isAdminSignedIn())) redirect('/admin/sign-in');

  return (
    <AdminShell pendingReviews={await pendingReviewsOrUndefined()} signOut={<SignOutButton />}>
      {children}
    </AdminShell>
  );
}

/**
 * The badge on the Reviews nav item, or nothing when it cannot be read.
 *
 * Swallowed for the same reason the storefront layout swallows a failed cart read: this runs on
 * every admin page, and an API blip must not turn the whole back office into an error boundary
 * over a number on a nav item. A 401 is different — the key has gone stale, and every screen
 * inside is about to fail, so that one redirects to sign in rather than rendering a shell that
 * cannot load anything.
 */
async function pendingReviewsOrUndefined(): Promise<number | undefined> {
  try {
    return (await fetchReviewCounts()).pending;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/admin/sign-in');
    return undefined;
  }
}
