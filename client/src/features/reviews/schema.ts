import { z } from 'zod';
import { DIFFICULTIES } from '@gunsnip/shared';

/**
 * The review shapes the storefront parses (CLAUDE.md: nothing untyped crosses the wire).
 *
 * Money does not appear here, but the rating does — as an integer 1–5, and as *tenths* for the
 * average, which is how the server stores it so it can sort and index without a float.
 */
export const REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const reviewPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string(),
});

export const productReviewSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.int().min(1).max(5),
  title: z.string(),
  body: z.string(),
  isVerifiedPurchase: z.boolean(),

  buildTimeMinutes: z.int().nullable(),
  experiencedDifficulty: z.enum(DIFFICULTIES).nullable(),
  toolsUsed: z.array(z.string()),

  photos: z.array(reviewPhotoSchema),
  adminReply: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type ProductReview = z.infer<typeof productReviewSchema>;

export const ratingBucketSchema = z.object({
  rating: z.int().min(1).max(5),
  count: z.int(),
  /** Whole percent of approved reviews at this rating — the bar's width. */
  percent: z.int(),
});

export type RatingBucket = z.infer<typeof ratingBucketSchema>;

export const productReviewSummarySchema = z.object({
  count: z.int(),
  /** Tenths, as an integer: 48 is 4.8. */
  averageTenths: z.int(),
  histogram: z.array(ratingBucketSchema),
  withPhotosCount: z.int(),
});

export type ProductReviewSummary = z.infer<typeof productReviewSummarySchema>;

export const productReviewsPageSchema = z.object({
  summary: productReviewSummarySchema,
  items: z.array(productReviewSchema),
  nextCursor: z.string().nullable(),
});

export type ProductReviewsPage = z.infer<typeof productReviewsPageSchema>;

/** What a review invite link authorises (FR-REV-02). */
export const reviewInviteSchema = z.object({
  token: z.string(),
  orderNumber: z.string(),
  expiresAt: z.iso.datetime(),
  product: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    imageUrl: z.string().nullable(),
  }),
  /** Whether to ask the build questions — a nipper has no build time (FR-REV-04). */
  isKit: z.boolean(),
  suggestedAuthorName: z.string(),
});

export type ReviewInvite = z.infer<typeof reviewInviteSchema>;

export const submittedReviewSchema = z.object({
  id: z.string(),
  status: z.literal('PENDING'),
});

/** `POST /reviews/photos`: where the compressed photo now lives, for the review to name. */
export const uploadedReviewPhotoSchema = z.object({ url: z.string() });

/** A review carries at most this many photos (the server's `ArrayMaxSize`). */
export const MAX_REVIEW_PHOTOS = 6;

/** What the form sends. No product: the token already knows what is being reviewed. */
export interface SubmitReviewBody {
  token: string;
  rating: number;
  authorName: string;
  title: string;
  body: string;
  buildTimeMinutes?: number;
  experiencedDifficulty?: (typeof DIFFICULTIES)[number];
  toolsUsed?: string[];
  photos?: { url: string; alt: string }[];
}
