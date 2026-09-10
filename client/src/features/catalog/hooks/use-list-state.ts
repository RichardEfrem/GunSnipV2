'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import { buildHref, parseListState, type ListState } from '../search-params';

/**
 * Reads the listing's state from the URL and navigates to change it (FR-CAT-07).
 *
 * There is deliberately no `useState` here. The URL *is* the state: a filter is applied by
 * navigating, the server re-renders, and the new props arrive. Mirroring it locally would give
 * two sources of truth that disagree the moment someone presses Back — which is exactly the
 * failure DoD §13.1 checks for.
 *
 * `isPending` comes from the transition wrapping the navigation, so the grid can dim while the
 * server works instead of freezing with no feedback.
 */
export interface ListNavigation {
  state: ListState;
  navigate: (next: ListState) => void;
  isPending: boolean;
  hrefFor: (next: ListState) => string;
}

export function useListState(): ListNavigation {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // `useSearchParams` returns a new object identity per render, so the parse is memoised on the
  // string form — otherwise every consumer re-renders on any parent update.
  const query = searchParams.toString();
  const state = useMemo(() => parseListState(new URLSearchParams(query)), [query]);

  const hrefFor = useCallback((next: ListState) => buildHref(pathname, next), [pathname]);

  const navigate = useCallback(
    (next: ListState) => {
      startTransition(() => {
        // `scroll: false` keeps the viewport where it is when a filter is ticked — jumping to
        // the top of the page on every checkbox loses the user's place in the rail.
        router.push(buildHref(pathname, next), { scroll: false });
      });
    },
    [pathname, router],
  );

  return { state, navigate, isPending, hrefFor };
}
