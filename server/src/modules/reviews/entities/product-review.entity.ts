import type { Difficulty } from '@gunsnip/shared';
import type { RatingHistogram } from '../rating-histogram.js';

/**
 * A review as the product page shows it (FR-REV-01, FR-REV-03, FR-REV-04).
 *
 * Only ever built from an APPROVED row. Nothing here identifies the reviewer beyond the name
 * they chose: the session that wrote it is on the row and stays there, because a public reviewer
 * list that let two reviews be tied to one person is a privacy leak nobody asked for.
 */
export interface ProductReviewView {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  /** True only when the review came through a delivered order line (FR-REV-03). */
  isVerifiedPurchase: boolean;

  // ---- kit-only, and null on a tool review (FR-REV-04)
  buildTimeMinutes: number | null;
  experiencedDifficulty: Difficulty | null;
  toolsUsed: readonly string[];

  photos: readonly ReviewPhotoView[];
  /** The shop's public response, when it has made one (FR-REV-06). */
  adminReply: string | null;
  createdAt: string;
}

export interface ReviewPhotoView {
  id: string;
  url: string;
  alt: string;
}

/**
 * What sits above the list: the average, the distribution, and how many reviews carry photos
 * (FR-REV-05).
 *
 * Computed over *every* approved review of the product, not over the page being shown. A
 * histogram that described the current page would change as the reader paged through it.
 */
export interface ProductReviewSummary {
  count: number;
  /** Tenths, as an integer — 48 is 4.8. The same scale the product counter uses. */
  averageTenths: number;
  histogram: RatingHistogram;
  /** Enables the photos-only filter, and tells the reader whether it is worth using. */
  withPhotosCount: number;
}

export interface ProductReviewsPage {
  summary: ProductReviewSummary;
  items: readonly ProductReviewView[];
  nextCursor: string | null;
}
