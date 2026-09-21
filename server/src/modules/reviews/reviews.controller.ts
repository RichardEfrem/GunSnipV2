import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Actor } from '@gunsnip/shared';
import { CurrentActor } from '../../common/decorators/current-actor.decorator.js';
import { MAX_IMAGE_BYTES, type UploadedFile as StoredUpload } from '../media/media-storage.js';
import { SubmitReviewDto } from './dto/submit-review.dto.js';
import { UploadReviewPhotoDto } from './dto/upload-review-photo.dto.js';
import type { ReviewInviteView } from './entities/review-invite.entity.js';
import { ReviewPhotoRateLimitGuard } from './review-photo-rate-limit.guard.js';
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

  /** One photo, compressed to WebP. The review then carries the URL this returns (FR-REV-01). */
  @Post('photos')
  @UseGuards(ReviewPhotoRateLimitGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async uploadPhoto(
    @UploadedFile() file: StoredUpload | undefined,
    @Body() dto: UploadReviewPhotoDto,
  ): Promise<{ url: string }> {
    return this.submissions.uploadPhoto(dto.token, file);
  }

  @Post()
  async submit(
    @CurrentActor() actor: Actor,
    @Body() dto: SubmitReviewDto,
  ): Promise<{ id: string; status: 'PENDING' }> {
    return this.submissions.submit(actor, dto);
  }
}
