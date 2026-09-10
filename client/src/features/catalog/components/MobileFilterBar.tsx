'use client';

import { ArrowDownUp, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { PRODUCT_SORTS, type ProductSort } from '@gunsnip/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useDraftFilters } from '../hooks/use-draft-filters';
import { useListState } from '../hooks/use-list-state';
import type { Facets } from '../schema';
import { hasActiveFilters, setSort } from '../search-params';
import { FilterControls } from './FilterControls';

/**
 * The mobile filter and sort controls (DESIGN.md §3.3).
 *
 * Both open bottom sheets covering ~85% of the height, so the results stay partly visible and
 * the sheet reads as covering the page rather than replacing it.
 *
 * The filter sheet **batches**: ticking options builds a draft and the apply button shows a
 * live count — "Show 218 kits" — that updates before anything is committed. On mobile the
 * results are hidden behind the sheet, so without that number every tick would be blind. The
 * desktop rail commits immediately for the opposite reason: there, the grid is right beside it.
 */
const SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'Relevance',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  best_selling: 'Best selling',
  top_rated: 'Highest rated',
};

interface MobileFilterBarProps {
  facets: Facets;
  isToolTree: boolean;
  /** Null on a search results page (FR-SRCH-06). */
  category: string | null;
  /** "218 kits" / "26 tools" — the noun matches the tree being browsed. */
  itemNoun: string;
  hasQuery?: boolean;
}

export function MobileFilterBar({
  facets,
  isToolTree,
  category,
  itemNoun,
  hasQuery = false,
}: MobileFilterBarProps) {
  const { state, navigate } = useListState();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const drafts = useDraftFilters(state, category, facets.total);

  const openFilters = () => {
    // The draft and its count both start from what the URL says now, not from whatever was left
    // behind last time the sheet was closed without applying.
    drafts.reset(state, facets.total);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setIsFilterOpen(false);
    navigate(drafts.draft);
  };

  return (
    <div className="flex gap-2 lg:hidden">
      <Button variant="secondary" onClick={openFilters} className="flex-1">
        <SlidersHorizontal className="size-4" aria-hidden />
        Filter
        {hasActiveFilters(state) && (
          <span className="grid size-5 place-items-center rounded-full bg-core-blue text-xs text-white">
            {activeCount(state)}
          </span>
        )}
      </Button>

      <Button variant="secondary" onClick={() => setIsSortOpen(true)} className="flex-1">
        <ArrowDownUp className="size-4" aria-hidden />
        Sort
      </Button>

      <Sheet
        open={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        title="Filter"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={drafts.clear} className="flex-1">
              Clear all
            </Button>
            <Button onClick={applyFilters} isLoading={drafts.isCounting} className="flex-[2]">
              {/* Falls back to a label without a number when the count could not be fetched —
                  the filters still apply, we just cannot promise how many. */}
              {drafts.count === null ? 'Show results' : `Show ${drafts.count} ${itemNoun}`}
            </Button>
          </div>
        }
      >
        <FilterControls
          facets={facets}
          state={drafts.draft}
          isToolTree={isToolTree}
          onToggle={drafts.toggle}
          onStockOnlyChange={drafts.setStockOnly}
        />
      </Sheet>

      <Sheet open={isSortOpen} onOpenChange={setIsSortOpen} title="Sort by">
        <ul className="flex flex-col">
          {PRODUCT_SORTS.filter((sort) => hasQuery || sort !== 'relevance').map((sort) => (
            <li key={sort}>
              <button
                type="button"
                onClick={() => {
                  setIsSortOpen(false);
                  navigate(setSort(state, sort));
                }}
                aria-current={sort === state.sort ? 'true' : undefined}
                className={cn(
                  'reticle flex min-h-12 w-full items-center rounded-sm px-2 text-left text-base',
                  sort === state.sort ? 'font-semibold text-core-blue' : 'text-ink',
                )}
              >
                {SORT_LABELS[sort]}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function activeCount(state: ReturnType<typeof useListState>['state']): number {
  const fromFilters = Object.values(state.filters).reduce((total, values) => total + values.length, 0);
  const fromPrice = state.minPrice === null && state.maxPrice === null ? 0 : 1;

  return fromFilters + (state.inStock ? 1 : 0) + fromPrice;
}
