import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PRODUCT_STATUSES, PRODUCT_TYPES, type ProductStatus, type ProductType } from '@gunsnip/shared';
import { ToInt } from '../../../common/transforms/query.js';

export const DEFAULT_ADMIN_PAGE_SIZE = 25;
/** The cap CLAUDE.md requires. Above this it is an export, not a page. */
export const MAX_ADMIN_PAGE_SIZE = 100;

/**
 * `GET /admin/products` (FR-ADM-02).
 *
 * Not the storefront's `ListProductsDto`: this one sees drafts and archived products, sorts by
 * when they were last touched rather than by relevance, and is cursor-paginated because nobody
 * links to page 7 of the product list. Sharing the storefront DTO would have meant a
 * `includeDrafts` flag on a query the storefront also uses — one flag away from leaking an
 * unannounced product onto a category page.
 */
export class ListAdminProductsDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  readonly status?: ProductStatus;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  readonly type?: ProductType;

  /** Name, slug or SKU, case-insensitive. A plain contains match — this is not the search index. */
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
  @Max(MAX_ADMIN_PAGE_SIZE)
  readonly limit?: number;
}
