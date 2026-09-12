'use client';

import { Button } from '@/components/ui/Button';
import { useListState } from '../hooks/use-list-state';
import type { Facets } from '../schema';
import { clearFilters, hasActiveFilters, setInStock, toggleFilter } from '../search-params';
import { FilterControls } from './FilterControls';

/**
 * The desktop filter rail — 240px, sticky (DESIGN.md §3.2).
 *
 * Every tick navigates immediately. There is no "apply" button here and there should not be:
 * on a wide screen the results are visible beside the rail, so the change *is* the feedback.
 * The mobile sheet is the one that batches, because there the results are hidden behind it.
 */
export function FilterRail({ facets, isToolTree }: { facets: Facets; isToolTree: boolean }) {
  const { state, navigate } = useListState();

  return (
    <aside className="sticky top-4 hidden w-60 shrink-0 self-start lg:block" aria-label="Filters">
      <div className="flex items-center justify-between gap-2 border-b border-armor-150 pb-2">
        <h2 className="font-display text-base font-semibold">Filters</h2>
        {hasActiveFilters(state) && (
          <Button variant="ghost" onClick={() => navigate(clearFilters(state))} className="h-8 px-2 text-sm">
            Clear all
          </Button>
        )}
      </div>

      <FilterControls
        facets={facets}
        state={state}
        isToolTree={isToolTree}
        onToggle={(key, value) => navigate(toggleFilter(state, key, value))}
        onStockOnlyChange={(inStock) => navigate(setInStock(state, inStock))}
      />
    </aside>
  );
}
