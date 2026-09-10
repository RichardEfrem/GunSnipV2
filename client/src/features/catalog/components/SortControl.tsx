'use client';

import { PRODUCT_SORTS, type ProductSort } from '@gunsnip/shared';
import { Select } from '@/components/ui/Select';
import { useListState } from '../hooks/use-list-state';
import { setSort } from '../search-params';

/**
 * Sort (FR-CAT-06). Changing it navigates, like every other piece of listing state.
 *
 * `relevance` is offered only where there is a query to be relevant to — on a category listing
 * it would rank by nothing, so it is left out rather than shown as a sort that does nothing
 * visible. Phase 4's search results page passes `hasQuery`.
 */
const LABELS: Record<ProductSort, string> = {
  relevance: 'Relevance',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  best_selling: 'Best selling',
  top_rated: 'Highest rated',
};

export function SortControl({ hasQuery = false }: { hasQuery?: boolean }) {
  const { state, navigate } = useListState();

  const options = PRODUCT_SORTS.filter((sort) => hasQuery || sort !== 'relevance').map((sort) => ({
    value: sort,
    label: LABELS[sort],
  }));

  return (
    <Select
      label="Sort by"
      value={state.sort}
      onValueChange={(value) => navigate(setSort(state, value as ProductSort))}
      options={options}
      className="w-52"
    />
  );
}
