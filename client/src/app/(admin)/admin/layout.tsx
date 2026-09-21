import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Everything under `/admin`, chrome included and sign-in excluded.
 *
 * This layout deliberately renders nothing but its children. The shell and its auth check live
 * one level down in `(shell)/layout.tsx`, because a layout that redirects unauthenticated
 * visitors to `/admin/sign-in` cannot also wrap that page — it would redirect to itself for
 * ever. The `(shell)` group keeps the URLs unchanged while leaving sign-in outside it.
 *
 * The metadata stays here so it covers sign-in too: `noindex` because a back office has no
 * business in a search result, even a guarded one.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · GunSnip Admin' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
