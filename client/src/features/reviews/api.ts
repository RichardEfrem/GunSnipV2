import { serverApiFetch } from '@/lib/api-server';
import {
  productReviewsPageSchema,
  reviewInviteSchema,
  type ProductReviewsPage,
  type ReviewInvite,
} from './schema';

/**
 * Review reads made on the server (CLAUDE.md: no fetch calls in components).
 *
 * The product page renders its first page of reviews server-side so they are in the HTML — a
 * review that only appears after hydration is a review a search engine never sees, and
 * `AggregateRating` in the page's JSON-LD is only honest if the reviews behind it are there.
 */
const REVIEWS_TTL_SECONDS = 60;

export async function fetchProductReviews(slug: string, query = ''): Promise<ProductReviewsPage> {
  const path = `/products/${encodeURIComponent(slug)}/reviews${query === '' ? '' : `?${query}`}`;

  return serverApiFetch(path, {
    schema: productReviewsPageSchema,
    next: { revalidate: REVIEWS_TTL_SECONDS, tags: ['reviews'] },
  });
}

/**
 * The invite behind a review link. Never cached: it is a one-use credential, and a cached
 * "still valid" would tell a second visitor the link works after the first has spent it.
 */
export async function fetchReviewInvite(token: string): Promise<ReviewInvite> {
  return serverApiFetch(`/reviews/invites/${encodeURIComponent(token)}`, {
    schema: reviewInviteSchema,
    cache: 'no-store',
  });
}
