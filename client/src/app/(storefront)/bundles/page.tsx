import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchBundles } from '@/features/bundles/api';
import { BundleCard } from '@/features/bundles/components/BundleCard';
import type { Bundle } from '@/features/bundles/schema';

/**
 * Curated bundles (FR-CAT-11).
 *
 * A short, operator-curated list rather than a filtered listing: there are a handful of these and
 * they are chosen by hand, so there is nothing to facet and nothing to paginate.
 */
export const metadata: Metadata = {
  title: 'Bundles',
  description: 'Kit and tools together, at a set price.',
  alternates: { canonical: '/bundles' },
};

export default async function BundlesPage() {
  let bundles: Bundle[] | null = null;

  try {
    bundles = await fetchBundles();
  } catch {
    bundles = null;
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-6">
      <Breadcrumbs
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Bundles', href: '/bundles' },
        ]}
      />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">Bundles</h1>
        <p className="max-w-prose text-sm text-frame-300">
          A kit and everything it needs, at one price. Add the whole set in a single step.
        </p>
      </header>

      {bundles === null ? (
        <ErrorState title="Couldn't load the bundles" description="Try again in a moment." />
      ) : bundles.length === 0 ? (
        <EmptyState title="No bundles right now" description="Check back — these change with the stock." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <li key={bundle.id}>
              <BundleCard bundle={bundle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
