import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PRODUCT_SORTS, type ProductSort } from '@gunsnip/shared';
import { ToInt } from '../../../common/transforms/query.js';
import { ProductFilterDto } from './product-filter.dto.js';

/** Cards per page. Divides by 2, 3, 4 and 5 so the grid never ends in a ragged row (DESIGN.md §3.2). */
export const DEFAULT_PAGE_SIZE = 24;

/**
 * The hard cap CLAUDE.md requires on every list endpoint. Above this the response stops being a
 * page and starts being an export, which is a different endpoint with different authorisation.
 */
export const MAX_PAGE_SIZE = 60;

/**
 * A bound on `page` as well as on `limit`. Without one, `?page=90000000` is an invitation to
 * make the database scan the whole table and throw it away — a cap on page size alone does not
 * stop that, because the cost is in the OFFSET.
 */
export const MAX_PAGE = 500;

/**
 * Listing query (FR-CAT-06, FR-CAT-07, FR-CAT-09).
 *
 * **Offset paginated, not cursor paginated**, which is a deliberate exception to CLAUDE.md's
 * "every list endpoint is cursor-paginated". FR-CAT-09 requires numbered pages and FR-CAT-07
 * requires the URL to be the whole state — and a cursor is an opaque token that cannot express
 * "page 3" in a link someone pastes to a friend. "Load more" is the same offset walked forward,
 * so both controls read one mechanism. The cap above is what a cursor would otherwise buy.
 *
 * Cursor pagination stays the rule everywhere numbered pages are not a requirement: orders,
 * admin lists, movements.
 */
export class ListProductsDto extends ProductFilterDto {
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  readonly sort?: ProductSort;

  /** 1-based, because it is shown to a person. */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  readonly page?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  readonly limit?: number;
}
