import { apiFetch } from '@/lib/api-client';
import {
  productReviewsPageSchema,
  submittedReviewSchema,
  type ProductReviewsPage,
  type SubmitReviewBody,
} from './schema';

/**
 * Reviews from the browser: paging the list, changing its sort, and submitting one.
 *
 * Separate from `api.ts` because that module reaches for `next/headers`, which cannot appear in
 * a Client Component's module graph.
 */
export async function fetchMoreReviews(slug: string, query: string): Promise<ProductReviewsPage> {
  return apiFetch(`/products/${encodeURIComponent(slug)}/reviews?${query}`, {
    schema: productReviewsPageSchema,
  });
}

export async function submitReview(body: SubmitReviewBody): Promise<{ id: string; status: 'PENDING' }> {
  return apiFetch('/reviews', { schema: submittedReviewSchema, method: 'POST', body });
}
