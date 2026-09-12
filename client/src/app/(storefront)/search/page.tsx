import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCategoryTree, fetchProducts } from '@/features/catalog/api';
import { AppliedFilters } from '@/features/catalog/components/AppliedFilters';
import { FilterRail } from '@/features/catalog/components/FilterRail';
import { MobileFilterBar } from '@/features/catalog/components/MobileFilterBar';
import { Pagination } from '@/features/catalog/components/Pagination';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/components/ProductGrid';
import { SortControl } from '@/features/catalog/components/SortControl';
import {
  pagesToFetch,
  parseListState,
  toApiQuery,
  toFacetQuery,
  toSearchParams,
  type ListState,
} from '@/features/catalog/search-params';
import { fetchSearchFacets, fetchSearchResults } from '@/features/search/api';
import { ZeroResults } from '@/features/search/components/ZeroResults';
import type { SearchResults } from '@/features/search/schema';

/**
 * The search results page (FR-SRCH-06, FR-SRCH-07).
 *
 * **This file imports the catalogue's listing components on purpose**, which CLAUDE.md's feature
 * slices otherwise forbid. FR-SRCH-06 is the reason: the requirement is that the results page
 * uses the *identical* filter and sort rail as a category page, and the only way to guarantee
 * "identical" is for it to be the same components. Lifting them to `components/ui` is not the
 * alternative — they carry catalogue rules (stock states, badge priority, facet vocabulary) and
 * a primitive that knows what a grade is has stopped being a primitive.
 *
 * The dependency runs one way, search → catalogue, exactly as it does on the server where
 * `SearchModule` imports `CatalogModule`. Nothing in `features/catalog` may import from here.
 *
 * A Server Component, like the category listing, so results are server-rendered and the whole
 * view is reconstructed from the URL on every navigation — the query included, because `q` is
 * part of `ListState` and every control carries it forward.
 */

/** Matches the grid and the category listing: 24 divides by 2, 3, 4 and 5. */
const PAGE_SIZE = 24;

/** Enough to fill the "popular right now" rail on a dead end (FR-SRCH-07). */
const POPULAR_COUNT = 8;

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const state = parseListState(toSearchParams(await searchParams));

  return {
    title: state.q === null ? 'Search' : `${state.q} — search`,
    // A results page is a view of the catalogue, not a document worth indexing on its own, and
    // an unbounded query string is an unbounded number of URLs to crawl.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const state = parseListState(toSearchParams(await searchParams));

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-6">
      <h1 className="text-3xl">
        {state.q === null ? 'Search' : <>Results for “{state.q}”</>}
      </h1>

      {state.q === null ? (
        <EmptyState
          className="border border-armor-150 bg-armor-000"
          title="What are you building?"
          description="Search by kit, mobile suit or part number — “Barbatos”, “RX-78-2”, “panel liner”."
          action={
            <Link href="/kits" className={buttonStyles('secondary')}>
              Browse all kits
            </Link>
          }
        />
      ) : (
        // Keyed on the query so a brand new search shows skeletons rather than holding the
        // previous query's results on screen. A filter change keeps them — that is the same
        // list being narrowed, and blanking it would lose the customer's place.
        <Suspense key={state.q} fallback={<ResultsSkeleton />}>
          <Results state={state} />
        </Suspense>
      )}
    </div>
  );
}

async function Results({ state }: { state: ListState }) {
  // Facets and every loaded page go out together — independent queries, and issuing them in
  // sequence would add a round trip per appended page.
  const [facetsResult, ...pageResults] = await Promise.allSettled([
    fetchSearchFacets(toFacetQuery(state, null)),
    ...pagesToFetch(state).map((page) =>
      fetchSearchResults(toApiQuery(state, null, PAGE_SIZE, page)),
    ),
  ]);

  if (
    facetsResult.status === 'rejected' ||
    pageResults.some((result) => result.status === 'rejected')
  ) {
    return (
      <ErrorState
        title="Couldn't run that search"
        description="The catalogue didn't respond. Your cart is safe — try again in a moment."
        action={
          <Link href={`/search?q=${encodeURIComponent(state.q ?? '')}`} className={buttonStyles('secondary')}>
            Try again
          </Link>
        }
      />
    );
  }

  const facets = facetsResult.value;
  const pages = pageResults.map((result) => (result as PromiseFulfilledResult<SearchResults>).value);
  const products = pages.flatMap((page) => page.items);
  const first = pages[0];

  // Nothing matched at all — not "nothing matched these filters". The way out is a different
  // query, so the filter rail would be furniture around a dead end (FR-SRCH-07).
  if (first.strategy === 'NONE') {
    const [categories, popular] = await Promise.all([
      fetchCategoryTree(),
      fetchProducts(`sort=best_selling&limit=${POPULAR_COUNT}`),
    ]);

    return (
      <ZeroResults
        query={first.query}
        didYouMean={first.didYouMean}
        categories={categories}
        popular={popular.items}
      />
    );
  }

  return (
    <div className="flex gap-8">
      <FilterRail facets={facets} isToolTree={false} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-4">
          {first.strategy === 'FUZZY' ? <FuzzyNotice results={first} /> : null}

          <MobileFilterBar
            facets={facets}
            isToolTree={false}
            category={null}
            itemNoun="results"
            hasQuery
          />

          <AppliedFilters facets={facets} />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm tabular-nums text-frame-300">
              {first.total} {first.total === 1 ? 'result' : 'results'}
            </p>
            <div className="hidden lg:block">
              <SortControl hasQuery />
            </div>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            className="mt-4 border border-armor-150 bg-armor-000"
            title="No results match these filters"
            description={
              state.inStock && facets.inStockCount === 0
                ? `Everything matching “${first.query}” is currently out of stock. Removing "In stock only" shows ${facets.total}.`
                : 'Try removing a filter — each one narrows the results further.'
            }
            action={
              <Link href={`/search?q=${encodeURIComponent(first.query)}`} className={buttonStyles('secondary')}>
                Clear all filters
              </Link>
            }
          />
        ) : (
          <ProductGrid products={products} priorityCount={5} className="mt-4" />
        )}

        <Pagination
          lastLoadedPage={state.page + state.more}
          totalPages={first.totalPages}
          shown={products.length}
          total={first.total}
        />
      </div>
    </div>
  );
}

/**
 * Says so when the results came from similarity rather than an exact match (FR-SRCH-05).
 *
 * Passing fuzzy results off as exact is the dishonest option and it is also the confusing one —
 * someone who typed "barbatso" and got Barbatos kits with no explanation cannot tell whether the
 * shop understood them or got lucky.
 */
function FuzzyNotice({ results }: { results: SearchResults }) {
  return (
    <p className="border border-armor-150 bg-armor-000 px-3 py-2 text-sm text-frame-300">
      No exact matches for “{results.query}” — showing close matches
      {results.didYouMean === null ? null : (
        <>
          {'. Search instead for '}
          <Link
            href={`/search?q=${encodeURIComponent(results.didYouMean)}`}
            className="reticle rounded-sm text-core-blue underline"
          >
            {results.didYouMean}
          </Link>
        </>
      )}
      .
    </p>
  );
}

/** Matches the real layout's dimensions so the page does not reflow when results arrive. */
function ResultsSkeleton() {
  return (
    <div className="flex gap-8">
      <div className="hidden w-60 shrink-0 flex-col gap-3 lg:flex">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="hidden h-11 w-52 lg:block" />
        </div>
        <ProductGridSkeleton count={10} className="mt-4" />
      </div>
    </div>
  );
}
