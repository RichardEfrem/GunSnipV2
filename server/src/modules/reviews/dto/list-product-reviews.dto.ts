import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToBoolean, ToInt } from '../../../common/transforms/query.js';

export const DEFAULT_PRODUCT_REVIEW_PAGE_SIZE = 10;
/** The cap CLAUDE.md requires on every list endpoint. */
export const MAX_PRODUCT_REVIEW_PAGE_SIZE = 50;

/**
 * The three orderings FR-REV-05 asks for. Named rather than a free `sort`/`dir` pair, so the
 * set of legal sorts is the type and a cursor can always be interpreted against the sort that
 * produced it.
 */
export const REVIEW_SORTS = ['newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** `GET /products/:slug/reviews` (FR-REV-05). */
export class ListProductReviewsDto {
  @IsOptional()
  @IsIn(REVIEW_SORTS)
  readonly sort?: ReviewSort;

  /** FR-REV-05's photos-only filter. Absent means every approved review. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  readonly withPhotos?: boolean;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_PRODUCT_REVIEW_PAGE_SIZE)
  readonly limit?: number;
}
