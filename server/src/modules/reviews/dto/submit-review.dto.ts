import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DIFFICULTIES, type Difficulty } from '@gunsnip/shared';
import { Trim } from '../../../common/transforms/text.js';

/** One photo on a review (FR-REV-01). Uploaded first; the review carries the resulting URLs. */
export class ReviewPhotoDto {
  @IsUrl({ require_protocol: false, require_host: false, require_tld: false })
  @MaxLength(500)
  readonly url!: string;

  /**
   * Required, not optional. An image with no alternative text is invisible to a screen reader,
   * and WCAG 2.1 AA is a non-functional requirement of this project (PRD §12), not a nice-to-have
   * that a customer-supplied photo gets to opt out of.
   */
  @IsString()
  @Trim()
  @MinLength(2)
  @MaxLength(200)
  readonly alt!: string;
}

/**
 * `POST /reviews` (FR-REV-01, FR-REV-04).
 *
 * There is no `productId` and no `orderItemId`: the invite token decides both. A body that could
 * name its own product would let anyone holding one link review the whole catalogue.
 */
export class SubmitReviewDto {
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  readonly token!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  readonly rating!: number;

  @IsString()
  @Trim()
  @MinLength(2)
  @MaxLength(60)
  readonly authorName!: string;

  @IsString()
  @Trim()
  @MinLength(3)
  @MaxLength(120)
  readonly title!: string;

  @IsString()
  @Trim()
  @MinLength(10)
  @MaxLength(4000)
  readonly body!: string;

  // ---- build-specific, and only meaningful on a kit (FR-REV-04)

  /**
   * Capped at a fortnight of continuous building. Not a guess at how long a kit takes — a
   * Perfect Grade genuinely runs to tens of hours — but a bound that keeps a mistyped field out
   * of the average without arguing with anyone's actual build.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20_160)
  readonly buildTimeMinutes?: number;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  readonly experiencedDifficulty?: Difficulty;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  readonly toolsUsed?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ReviewPhotoDto)
  readonly photos?: ReviewPhotoDto[];
}
