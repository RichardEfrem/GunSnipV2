import { Module } from '@nestjs/common';
import { ReviewModerationService } from './review-moderation.service.js';
import { ReviewRepository } from './review.repository.js';

/**
 * Reviews (FR-REV-01 … FR-REV-06).
 *
 * Phase 9 builds the moderation half (FR-ADM-11), because it is the gate everything else waits
 * behind: the customer-facing submission, invites and histogram of Phase 10 all produce or read
 * reviews that only matter once something decides which of them are visible.
 *
 * No controller of its own yet — the moderation routes live with the other admin routes, and the
 * storefront's read and write arrive in Phase 10.
 */
@Module({
  providers: [ReviewModerationService, ReviewRepository],
  exports: [ReviewModerationService],
})
export class ReviewsModule {}
