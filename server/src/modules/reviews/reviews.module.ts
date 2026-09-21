import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { MediaModule } from '../media/media.module.js';
import { ProductReviewsController } from './product-reviews.controller.js';
import { ReviewInviteRepository } from './review-invite.repository.js';
import { ReviewInviteService } from './review-invite.service.js';
import { ReviewListingService } from './review-listing.service.js';
import { ReviewModerationService } from './review-moderation.service.js';
import { ReviewSubmissionService } from './review-submission.service.js';
import { ReviewRepository } from './review.repository.js';
import { ReviewsController } from './reviews.controller.js';

/**
 * Reviews (FR-REV-01 … FR-REV-06).
 *
 * Phase 9 built the moderation half, because it is the gate everything else waits behind: only
 * an approved review reaches a product page or the rating counter on a product card. Phase 10
 * adds the three pieces that produce and read those rows — the tokenised invite that authorises
 * a review (FR-REV-02), the submission itself, and the public list with its histogram and
 * filters (FR-REV-05).
 *
 * `ReviewInviteService` is exported because delivery is what mints an invite, and the mail that
 * carries the links is the notification module's.
 */
@Module({
  imports: [MediaModule, RateLimitModule],
  controllers: [ProductReviewsController, ReviewsController],
  providers: [
    ReviewInviteRepository,
    ReviewInviteService,
    ReviewListingService,
    ReviewModerationService,
    ReviewSubmissionService,
    ReviewRepository,
  ],
  exports: [ReviewInviteService, ReviewModerationService],
})
export class ReviewsModule {}
