'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { fetchMoreReviews } from '../client-api';
import { REVIEW_SORTS, type ProductReview, type ProductReviewsPage, type ReviewSort } from '../schema';
import { ReviewCard } from './ReviewCard';
import { ReviewSummary } from './ReviewSummary';

/**
 * The reviews block on a product page (FR-REV-05).
 *
 * The first page arrives from the server, already in the HTML, so reviews are visible without
 * JavaScript and to a crawler. This component owns only what changes after that: the sort, the
 * photos-only filter, and "Show more".
 *
 * State rather than the URL, deliberately, and the one place this project departs from
 * "the URL is the source of truth" — that rule is FR-CAT-07, about the catalogue, where the
 * point is that a filtered listing can be shared. Nobody links a colleague to "the reviews tab,
 * sorted lowest"; putting it in the URL would only make the product page's canonical address
 * multiply.
 *
 * Fetches happen in event handlers, never in an effect (CLAUDE.md).
 */
const SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Most recent',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
};

interface ReviewSectionProps {
  slug: string;
  initial: ProductReviewsPage;
}

export function ReviewSection({ slug, initial }: ReviewSectionProps) {
  const [page, setPage] = useState(initial);
  const [items, setItems] = useState<ProductReview[]>(initial.items);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [withPhotos, setWithPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function queryFor(next: { sort: ReviewSort; withPhotos: boolean; cursor?: string }): string {
    const params = new URLSearchParams({ sort: next.sort });
    if (next.withPhotos) params.set('withPhotos', 'true');
    if (next.cursor !== undefined) params.set('cursor', next.cursor);

    return params.toString();
  }

  /** Re-reads the list from the top. Used by both controls, so they cannot diverge. */
  function reload(next: { sort: ReviewSort; withPhotos: boolean }): void {
    setSort(next.sort);
    setWithPhotos(next.withPhotos);
    setError(null);

    startTransition(async () => {
      try {
        const fresh = await fetchMoreReviews(slug, queryFor(next));
        setPage(fresh);
        setItems(fresh.items);
      } catch {
        setError('Could not load those reviews. Try again.');
      }
    });
  }

  function loadMore(): void {
    if (page.nextCursor === null) return;
    setError(null);

    startTransition(async () => {
      try {
        const more = await fetchMoreReviews(slug, queryFor({ sort, withPhotos, cursor: page.nextCursor ?? '' }));
        setPage(more);
        setItems((current) => [...current, ...more.items]);
      } catch {
        setError('Could not load more reviews. Try again.');
      }
    });
  }

  // The summary is over every approved review, so it is the honest test of "has this been
  // reviewed at all" — `items` can be empty because of the filter rather than because of that.
  if (page.summary.count === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Reviews come from builders who bought this here — we email a link once an order is delivered."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ReviewSummary summary={page.summary} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          label="Sort reviews"
          value={sort}
          onValueChange={(value) => reload({ sort: value as ReviewSort, withPhotos })}
          options={REVIEW_SORTS.map((option) => ({ value: option, label: SORT_LABELS[option] }))}
          disabled={isPending}
          className="w-48"
        />

        <Checkbox
          checked={withPhotos}
          onCheckedChange={(checked) => reload({ sort, withPhotos: checked })}
          disabled={isPending || page.summary.withPhotosCount === 0}
          label={`With photos only (${page.summary.withPhotosCount})`}
        />
      </div>

      {error !== null ? <ErrorState title="Something went wrong" description={error} /> : null}

      {items.length === 0 ? (
        <EmptyState
          title="No reviews with photos yet"
          description="Clear the filter to see every review of this kit."
        />
      ) : (
        <div className="flex flex-col" aria-busy={isPending}>
          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {page.nextCursor === null ? null : (
        <Button variant="secondary" onClick={loadMore} isLoading={isPending} className="self-start">
          Show more reviews
        </Button>
      )}
    </div>
  );
}
