import { apiFetch } from '@/lib/api-client';
import {
  productReviewsPageSchema,
  submittedReviewSchema,
  uploadedReviewPhotoSchema,
  type ProductReviewsPage,
  type SubmitReviewBody,
} from './schema';

/**
 * Reviews from the browser: paging the list, changing its sort, uploading photos and submitting one.
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

/** One photo, authorised by the invite token. The API compresses it to WebP and returns its URL. */
export async function uploadReviewPhoto(token: string, photo: File): Promise<{ url: string }> {
  const body = new FormData();
  body.set('token', token);
  body.set('file', photo);

  return apiFetch('/reviews/photos', { schema: uploadedReviewPhotoSchema, method: 'POST', body });
}
