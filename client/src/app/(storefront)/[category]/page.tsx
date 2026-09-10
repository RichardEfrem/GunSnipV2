import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { fetchCategory, fetchFacets, fetchProducts } from '@/features/catalog/api';
import { AppliedFilters } from '@/features/catalog/components/AppliedFilters';
import { FilterRail } from '@/features/catalog/components/FilterRail';
import { MobileFilterBar } from '@/features/catalog/components/MobileFilterBar';
import { Pagination } from '@/features/catalog/components/Pagination';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/components/ProductGrid';
import { SortControl } from '@/features/catalog/components/SortControl';
import type { CategoryDetail, ProductPage } from '@/features/catalog/schema';
import {
  pagesToFetch,
  parseListState,
  toApiQuery,
  toFacetQuery,
  toSearchParams,
  type ListState,
} from '@/features/catalog/search-params';
import { ApiError } from '@/lib/api-error';

/**
 * The category listing (FR-CAT-03 … FR-CAT-10).
 *
 * A Server Component, so the products are server-rendered and the whole view is reconstructed
 * from the URL on every navigation — which is what makes DoD §13.1 pass: filter, sort, copy the
 * address into a new tab, get the identical page.
 *
 * Category slugs are globally unique and already namespaced (`kits`, `kits-mg`,
 * `tools-nippers`), so they sit at the root as a single segment rather than under a `/c/`
 * prefix. Static routes win over this dynamic one in Next's matcher, so `/cart` and `/search`
 * are never mistaken for categories.
 *
 * **The category is resolved before anything is sent, and only the results stream.** That
 * ordering is what makes an unknown slug a true 404: Next writes the status line with the first
 * byte, so a `notFound()` raised from inside a Suspense boundary — or from a segment-wide
 * `loading.tsx`, or from `generateMetadata`, which Next 16 streams as well — arrives after the
 * headers have gone and cannot change them. The page would then answer a crawler with 200 and
 * 404-shaped content. Awaiting the category here costs one cached request and buys a correct
 * status; the grid, which is the slow part, still streams behind a skeleton.
 */

/** Matches the grid: 24 divides by 2, 3, 4 and 5, so no breakpoint ends in a ragged row. */
const PAGE_SIZE = 24;

export async function generateMetadata({ params }: PageProps<'/[category]'>): Promise<Metadata> {
  const { category } = await params;

  try {
    const detail = await fetchCategory(category);
    return { title: detail.name };
  } catch {
    // The page raises the 404; metadata must not be the thing that throws.
    return {};
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/[category]'>) {
  // All Promises in Next 16.
  const [{ category: slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const state = parseListState(toSearchParams(rawSearchParams));

  let category: CategoryDetail;

  try {
    // Deduplicated with the identical call in `generateMetadata`.
    category = await fetchCategory(slug);
  } catch (error) {
    // An unknown slug is a 404, not an error page — it is far more often a stale link than
    // anything being broken.
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  return (
    <Shell category={category}>
      {/* No `key`: on a filter change React keeps the current grid on screen until the next one
          is ready, rather than blanking back to skeletons. The skeleton is for the first load,
          where there is nothing to keep. */}
      <Suspense fallback={<ListingSkeleton />}>
        <Listing slug={slug} state={state} category={category} />
      </Suspense>
    </Shell>
  );
}

/** Everything that depends on the filters, and therefore everything worth streaming. */
async function Listing({
  slug,
  state,
  category,
}: {
  slug: string;
  state: ListState;
  category: CategoryDetail;
}) {
  const isToolTree = category.type === 'TOOL_SUPPLY';
  const itemNoun = isToolTree ? 'tools' : 'kits';

  // Facets and every loaded page go out together. They are independent queries, and issuing
  // them in sequence would add a round trip per appended page.
  const [facetsResult, ...pageResults] = await Promise.allSettled([
    fetchFacets(toFacetQuery(state, slug)),
    ...pagesToFetch(state).map((page) => fetchProducts(toApiQuery(state, slug, PAGE_SIZE, page))),
  ]);

  if (
    facetsResult.status === 'rejected' ||
    pageResults.some((result) => result.status === 'rejected')
  ) {
    return (
      <ErrorState
        title="Couldn't load these products"
        description="The catalogue didn't respond. Your cart is safe — try again in a moment."
        action={
          <Link href={`/${slug}`}>
            <Button variant="secondary">Try again</Button>
          </Link>
        }
      />
    );
  }

  const facets = facetsResult.value;
  const pages = pageResults.map((result) => (result as PromiseFulfilledResult<ProductPage>).value);
  const products = pages.flatMap((page) => page.items);
  const first = pages[0];

  return (
    <div className="flex gap-8">
      <FilterRail facets={facets} isToolTree={isToolTree} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-4">
          <MobileFilterBar
            facets={facets}
            isToolTree={isToolTree}
            category={slug}
            itemNoun={itemNoun}
          />

          <AppliedFilters facets={facets} />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm tabular-nums text-frame-300">
              {first.total} {itemNoun}
            </p>
            <div className="hidden lg:block">
              <SortControl />
            </div>
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            className="mt-4 border border-armor-150 bg-armor-000"
            title={`No ${itemNoun} match these filters`}
            description={
              state.inStock && facets.inStockCount === 0
                ? `Everything here is currently out of stock. Removing "In stock only" shows ${facets.total} ${itemNoun}.`
                : 'Try removing a filter — each one narrows the list further.'
            }
            action={
              <Link href={`/${slug}`}>
                <Button variant="secondary">Clear all filters</Button>
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
 * The loading state (DESIGN.md §4.5). Every block matches the real layout's dimensions, so the
 * page does not reflow when the products arrive.
 */
function ListingSkeleton() {
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

/** The page chrome, rendered immediately — it depends only on the category, never the filters. */
function Shell({ category, children }: { category: CategoryDetail; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-2">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            ...category.breadcrumbs.map((crumb) => ({ label: crumb.name, href: `/${crumb.slug}` })),
          ]}
        />
        <h1 className="text-3xl">{category.name}</h1>
      </div>

      {children}
    </div>
  );
}
