import { REVIEW_STATUSES } from '@gunsnip/shared';
import type { Metadata } from 'next';
import { ErrorState } from '@/components/ui/ErrorState';
import { fetchReviewCounts, fetchReviews } from '@/features/admin/api';
import { AdminListFilters } from '@/features/admin/components/AdminListFilters';
import { AdminPageHeader } from '@/features/admin/components/AdminPanel';
import { CursorPager } from '@/features/admin/components/CursorPager';
import { ReviewQueue } from '@/features/admin/components/ReviewQueue';
import { ApiError } from '@/lib/api-error';
import type { AdminReview, CursorPage, ReviewCounts } from '@/features/admin/schema';

export const metadata: Metadata = { title: 'Reviews' };

const STATUS_LABELS: Record<(typeof REVIEW_STATUSES)[number], string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * The moderation queue (FR-ADM-11).
 *
 * Defaults to pending, because that is the only list with work in it — and approving a review is
 * what puts it on the product page and moves the rating every card in the catalogue prints.
 */
export default async function AdminReviewsPage({ searchParams }: PageProps<'/admin/reviews'>) {
  const params = await searchParams;
  const query = { status: single(params.status), q: single(params.q), cursor: single(params.cursor) };

  let page: CursorPage<AdminReview>;
  let counts: ReviewCounts;

  try {
    [page, counts] = await Promise.all([fetchReviews(query), fetchReviewCounts()]);
  } catch (error) {
    return (
      <>
        <AdminPageHeader title="Reviews" />
        <ErrorState
          title="The review queue didn't load"
          description={error instanceof ApiError ? error.message : "The API didn't respond. Try again in a moment."}
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Reviews"
        description={`${counts.pending} pending · ${counts.approved} approved · ${counts.rejected} rejected. Only approved reviews reach the storefront.`}
      />

      <AdminListFilters
        basePath="/admin/reviews"
        search={{ name: 'q', label: 'Search', placeholder: 'Title, body, author or product', value: query.q }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: query.status ?? 'PENDING',
            options: REVIEW_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
          },
        ]}
      />

      <ReviewQueue reviews={page.items} className="mt-4" />

      <CursorPager basePath="/admin/reviews" params={params} nextCursor={page.nextCursor} />
    </>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
