import type { Metadata } from 'next';
import { SignInForm } from '@/features/admin/components/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/**
 * The back-office sign-in (PRD §11.2).
 *
 * Outside the admin layout on purpose — it has no sidebar and no data, and putting it inside
 * would mean the layout's own auth check redirecting to a page inside itself.
 */
export default async function AdminSignInPage({ searchParams }: PageProps<'/admin/sign-in'>) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-frame-900 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-lg font-semibold tracking-wide text-white">GUNSNIP ADMIN</h1>
        <p className="mb-6 text-sm text-frame-muted">Sign in with the store&rsquo;s admin key.</p>

        <SignInForm next={typeof next === 'string' ? next : undefined} />
      </div>
    </main>
  );
}
