'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-error';
import { fetchFacetCount } from '../client-api';
import {
  clearFilters,
  setInStock,
  toFacetQuery,
  toggleFilter,
  type ListFilterKey,
  type ListState,
} from '../search-params';

/**
 * The mobile filter sheet's pending selection and its live result count (DESIGN.md §3.3).
 *
 * This is the one place the listing holds filter state outside the URL, and it is deliberate: a
 * sheet lets you tick several options and *then* commit, so the draft has to live somewhere
 * until "Show N kits" is pressed. Committing hands it to the URL and the draft is discarded.
 *
 * The count is fetched from the toggle handler rather than from a `useEffect` watching the
 * draft (CLAUDE.md: no `useEffect` for data fetching). A tick is an event, the fetch is what
 * that event causes, and writing it that way means there is no render-then-sync round trip and
 * no dependency array to get wrong.
 */
export interface DraftFilters {
  draft: ListState;
  /** Result count for the draft. Null while the first one is still in flight. */
  count: number | null;
  isCounting: boolean;
  toggle: (key: ListFilterKey, value: string) => void;
  setStockOnly: (inStock: boolean) => void;
  clear: () => void;
  /** Discards the draft and starts again from what the URL currently says. */
  reset: (state: ListState, count: number) => void;
}

export function useDraftFilters(
  initial: ListState,
  /** Null on a search results page, where the list is scoped by the query instead. */
  category: string | null,
  initialCount: number,
): DraftFilters {
  const [draft, setDraft] = useState(initial);
  const [count, setCount] = useState<number | null>(initialCount);
  const [isCounting, setIsCounting] = useState(false);

  // Only the newest request may write the count. Without this, a slow response for an earlier
  // selection can land after a faster later one and show a number for filters nobody has set.
  const inFlight = useRef<AbortController | null>(null);

  const recount = useCallback(
    async (next: ListState) => {
      inFlight.current?.abort();

      const controller = new AbortController();
      inFlight.current = controller;
      setIsCounting(true);

      try {
        const facets = await fetchFacetCount(toFacetQuery(next, category), controller.signal);
        setCount(facets.total);
      } catch (error) {
        // An abort is this hook superseding itself, not a failure — the newer request owns the
        // count and will set it.
        if (controller.signal.aborted) return;

        // The button falls back to "Show results" without a number rather than blocking the
        // sheet: the filters are still applicable, we just cannot promise how many.
        setCount(null);
        if (!(error instanceof ApiError)) throw error;
      } finally {
        if (!controller.signal.aborted) setIsCounting(false);
      }
    },
    [category],
  );

  const apply = useCallback(
    (next: ListState) => {
      setDraft(next);
      void recount(next);
    },
    [recount],
  );

  return {
    draft,
    count,
    isCounting,
    toggle: useCallback(
      (key, value) => apply(toggleFilter(draft, key, value)),
      [apply, draft],
    ),
    setStockOnly: useCallback((inStock) => apply(setInStock(draft, inStock)), [apply, draft]),
    clear: useCallback(() => apply(clearFilters(draft)), [apply, draft]),
    reset: useCallback((state: ListState, resetCount: number) => {
      inFlight.current?.abort();
      setDraft(state);
      // The count has to come back with the draft. Reopening the sheet after closing it without
      // applying would otherwise show the abandoned draft's number against the real filters.
      setCount(resetCount);
      setIsCounting(false);
    }, []),
  };
}
