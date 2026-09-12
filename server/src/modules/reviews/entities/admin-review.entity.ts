import type { Difficulty, ReviewStatus } from '@gunsnip/shared';

/**
 * A review in the moderation queue (FR-ADM-11).
 *
 * Carries everything a moderator needs to decide without opening another screen: the text, the
 * product it is about, whether it is a verified purchase, and the build-specific fields
 * (FR-REV-04) — which matter here because a review claiming a two-hour build of a Perfect Grade
 * is the kind of thing moderation exists to catch.
 */
export interface AdminReview {
  id: string;
  status: ReviewStatus;

  product: { id: string; name: string; slug: string };

  authorName: string;
  rating: number;
  title: string;
  body: string;

  /** True only when the review is tied to a delivered order line (FR-REV-02). */
  isVerifiedPurchase: boolean;

  /** Kit-specific fields (FR-REV-04). Null on a tool review. */
  buildTimeMinutes: number | null;
  experiencedDifficulty: Difficulty | null;
  toolsUsed: readonly string[];

  photos: readonly { id: string; url: string; alt: string }[];

  /** The shop's public response, when one has been written. */
  adminReply: string | null;
  /** ISO 8601, UTC. Null while the review is still pending. */
  moderatedAt: string | null;
  createdAt: string;
}

/** How many reviews sit in each state — the badge on the moderation nav item. */
export interface ReviewQueueCounts {
  pending: number;
  approved: number;
  rejected: number;
}
