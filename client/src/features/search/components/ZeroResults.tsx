import Link from 'next/link';
import { buttonStyles } from '@/components/ui/button-styles';
import { ProductRail } from '@/features/catalog/components/ProductRail';
import type { CategoryNode, ProductSummary } from '@/features/catalog/schema';

/**
 * What a search that found nothing shows (FR-SRCH-07).
 *
 * The requirement is worded as "never a dead end", and that is the whole design: every element
 * here is a way out. A correction to click, somewhere to browse, and something to look at — a
 * page that only said "no results for xyz" would leave the customer with the back button as
 * their best option.
 *
 * The popular products come from the catalogue's existing best-selling listing rather than a
 * "popular" endpoint built for this page. There is nothing search-specific about them, and one
 * more endpoint to keep correct in exchange for nothing is a bad trade.
 */
interface ZeroResultsProps {
  query: string;
  /** The catalogue's nearest real word, when there is one worth offering. */
  didYouMean: string | null;
  categories: readonly CategoryNode[];
  popular: readonly ProductSummary[];
}

export function ZeroResults({ query, didYouMean, categories, popular }: ZeroResultsProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <h2 className="text-lg">No matches for “{query}”</h2>

        {didYouMean === null ? (
          <p className="max-w-measure text-sm text-frame-300">
            Try fewer words, or a mobile suit name like “Barbatos” or a part number like
            “RX-78-2”.
          </p>
        ) : (
          <p className="max-w-measure text-sm text-frame-300">
            Did you mean{' '}
            <Link
              href={`/search?q=${encodeURIComponent(didYouMean)}`}
              className="reticle rounded-sm text-core-blue underline"
            >
              {didYouMean}
            </Link>
            ?
          </p>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/kits" className={buttonStyles('secondary')}>
            Browse all kits
          </Link>
          <Link href="/tools" className={buttonStyles('ghost')}>
            Browse tools
          </Link>
        </div>
      </div>

      {categories.length === 0 ? null : (
        <section className="flex flex-col gap-3 px-4 md:px-6">
          <h3 className="font-display text-base font-semibold">
            Browse a category instead
          </h3>
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/${category.slug}`}
                  className="reticle inline-flex items-center gap-2 rounded-sm border border-armor-150 bg-armor-000 px-3 py-1.5 text-sm transition-colors duration-fast ease-out hover:border-core-blue hover:text-core-blue"
                >
                  {category.name}
                  <span className="tabular-nums text-frame-300">{category.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProductRail title="Popular right now" products={popular} href="/kits?sort=best_selling" />
    </div>
  );
}
