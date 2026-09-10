'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { formatIdr } from '@/lib/formatters';
import { useListState } from '../hooks/use-list-state';
import type { Facets } from '../schema';
import {
  clearFilters,
  hasActiveFilters,
  setInStock,
  toggleFilter,
  LIST_FILTER_KEYS,
  type ListFilterKey,
} from '../search-params';

/**
 * The applied-filter chips (FR-CAT-05, DESIGN.md §3.2).
 *
 * Non-negotiable: without them, a filtered result set reads as the whole catalogue, and someone
 * concludes the shop has four kits rather than that they asked for four.
 *
 * Labels come from the facet response rather than the raw URL value, so a chip says "Master
 * Grade" and not "MG". A value with no matching facet still gets a chip showing the raw value —
 * a filter you cannot see is a filter you cannot remove.
 */
const FACET_FOR_KEY: Record<ListFilterKey, keyof Pick<Facets, 'grades' | 'scales' | 'series' | 'brands' | 'difficulties' | 'toolJobs'>> = {
  grade: 'grades',
  scale: 'scales',
  series: 'series',
  brand: 'brands',
  difficulty: 'difficulties',
  toolJob: 'toolJobs',
};

export function AppliedFilters({ facets }: { facets: Facets }) {
  const { state, navigate } = useListState();

  if (!hasActiveFilters(state)) return null;

  const chips = LIST_FILTER_KEYS.flatMap((key) =>
    state.filters[key].map((value) => ({
      key,
      value,
      label: facets[FACET_FOR_KEY[key]].find((option) => option.value === value)?.label ?? value,
    })),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only">Applied filters</span>

      {chips.map((chip) => (
        <Chip
          key={`${chip.key}:${chip.value}`}
          label={chip.label}
          onRemove={() => navigate(toggleFilter(state, chip.key, chip.value))}
        />
      ))}

      {state.inStock && <Chip label="In stock" onRemove={() => navigate(setInStock(state, false))} />}

      {state.minPrice === null && state.maxPrice === null ? null : (
        <Chip
          label={priceLabel(state.minPrice, state.maxPrice)}
          onRemove={() => navigate({ ...state, minPrice: null, maxPrice: null, page: 1 })}
        />
      )}

      <Button variant="ghost" onClick={() => navigate(clearFilters(state))} className="h-8 px-2 text-sm">
        Clear all
      </Button>
    </div>
  );
}

function priceLabel(minIdr: number | null, maxIdr: number | null): string {
  if (minIdr !== null && maxIdr !== null) return `${formatIdr(minIdr)} – ${formatIdr(maxIdr)}`;
  return minIdr !== null ? `From ${formatIdr(minIdr)}` : `Up to ${formatIdr(maxIdr ?? 0)}`;
}
