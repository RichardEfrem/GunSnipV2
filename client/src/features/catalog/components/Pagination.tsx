'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useListState } from '../hooks/use-list-state';
import { appendPage, MAX_APPENDED_PAGES, setPage } from '../search-params';

/**
 * "Load more" plus numbered pages (FR-CAT-09).
 *
 * **Not infinite scroll** — it breaks footer access and deep linking, which is the whole reason
 * the requirement names both controls. Load more appends the next page below what is already
 * there; the numbers jump to a page. Both are still just the URL (`page` and `more`), so the
 * accumulated view is addressable and the back button walks back through the loads.
 *
 * The numbers are real `<a>` elements, so they can be opened in a new tab, copied and crawled.
 * Load more is a button: it extends the current view rather than naming a different one, and
 * the page it adds is only meaningful together with what is above it.
 */
interface PaginationProps {
  /** The last page currently on screen — page plus whatever "Load more" has appended. */
  lastLoadedPage: number;
  totalPages: number;
  /** Shown beside the controls: "Showing 24 of 218". */
  shown: number;
  total: number;
}

export function Pagination({ lastLoadedPage, totalPages, shown, total }: PaginationProps) {
  const { state, navigate, hrefFor, isPending } = useListState();

  if (total === 0) return null;

  // Load more stops at the cap, and at the end of the results. Past the cap the numbered pages
  // below are the way on — which is why both controls are always rendered together.
  const canLoadMore = lastLoadedPage < totalPages && state.more < MAX_APPENDED_PAGES;

  return (
    <nav className="flex flex-col items-center gap-4 py-8" aria-label="Pagination">
      <p className="text-sm text-frame-300" aria-live="polite">
        Showing {shown} of {total}
      </p>

      {canLoadMore && (
        <Button variant="secondary" isLoading={isPending} onClick={() => navigate(appendPage(state))}>
          Load more
        </Button>
      )}

      {totalPages > 1 && (
        <ol className="flex flex-wrap items-center justify-center gap-1">
          {pageNumbers(state.page, totalPages).map((entry, index) =>
            entry === null ? (
              <li key={`gap-${index}`} className="px-2 text-frame-300" aria-hidden>
                …
              </li>
            ) : (
              <li key={entry}>
                <Link
                  href={hrefFor(setPage(state, entry))}
                  scroll
                  aria-current={entry === state.page ? 'page' : undefined}
                  aria-label={`Page ${entry}`}
                  className={cn(
                    'reticle grid h-11 min-w-11 place-items-center rounded-sm px-2 font-display text-sm tabular-nums',
                    'transition-colors duration-fast ease-out',
                    entry === state.page
                      ? 'border border-core-blue text-core-blue'
                      : 'text-frame-300 hover:bg-ink-tint hover:text-ink',
                  )}
                >
                  {entry}
                </Link>
              </li>
            ),
          )}
        </ol>
      )}
    </nav>
  );
}

/**
 * `1 2 3 … 12` — first, last, and a window around the current page, with `null` for each gap.
 *
 * A bounded list rather than every page: a 40-page catalogue would otherwise render 40 links,
 * which wraps to four rows on mobile and buries the footer under the thing meant to reach it.
 */
export function pageNumbers(page: number, totalPages: number): (number | null)[] {
  const WINDOW = 1;
  const pages = new Set<number>([1, totalPages]);

  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  const sorted = [...pages].sort((left, right) => left - right);
  const result: (number | null)[] = [];

  for (const [index, entry] of sorted.entries()) {
    const previous = sorted[index - 1];
    // A gap of exactly one page renders as that page rather than an ellipsis — "1 … 3" hides a
    // link in the same width it would have taken to show it.
    if (previous !== undefined && entry - previous > 1) {
      result.push(entry - previous === 2 ? entry - 1 : null);
    }
    result.push(entry);
  }

  return result;
}
