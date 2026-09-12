import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { REVIEW_STATUSES, type ReviewStatus } from '@gunsnip/shared';
import { ToInt } from '../../../common/transforms/query.js';

export const DEFAULT_REVIEW_PAGE_SIZE = 25;
/** The cap CLAUDE.md requires on every list endpoint. */
export const MAX_REVIEW_PAGE_SIZE = 100;

/** `GET /admin/reviews` (FR-ADM-11). Defaults to the pending queue — the reason to open it. */
export class ListReviewsDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  readonly status?: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly q?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_REVIEW_PAGE_SIZE)
  readonly limit?: number;
}

/**
 * `POST /admin/reviews/:id/moderation` (FR-ADM-11).
 *
 * `PENDING` is not an option: moderation is a decision, and sending a review back to the queue
 * it came from would clear its `moderated_at` and lose the record that anyone had looked at it.
 */
const DECISIONS = ['APPROVED', 'REJECTED'] as const;

export class ModerateReviewDto {
  @IsIn([...DECISIONS], { message: `status must be one of: ${DECISIONS.join(', ')}` })
  readonly status!: (typeof DECISIONS)[number];
}

/** `PUT /admin/reviews/:id/reply` — the shop's public response to a review. */
export class ReplyToReviewDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  readonly adminReply?: string | null;
}
