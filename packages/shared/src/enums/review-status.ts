/** Moderation state of a review (FR-REV-06). Only APPROVED reviews reach the storefront. */
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
