import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { SubmitReviewDto } from './dto/submit-review.dto.js';
import type { ReviewInviteView } from './entities/review-invite.entity.js';
import { ReviewInviteService } from './review-invite.service.js';
import { ReviewSubmissionService } from './review-submission.service.js';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly invites: ReviewInviteService,
    private readonly submissions: ReviewSubmissionService,
  ) {}

  /** What a review link authorises, so the form can be rendered on the server (FR-REV-02). */
  @Get('invites/:token')
  async invite(@Param('token') token: string): Promise<ReviewInviteView> {
    return this.invites.resolve(token);
  }

  @Post()
  async submit(
    @CurrentActor() actor: Actor,
    @Body() dto: SubmitReviewDto,
  ): Promise<{ id: string; status: 'PENDING' }> {
    return this.submissions.submit(actor, dto);
  }
}
