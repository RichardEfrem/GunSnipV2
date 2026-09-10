import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DIFFICULTIES, PRODUCT_TYPES, TOOL_JOBS } from '@gunsnip/shared';
import { ToBoolean, ToInt, ToStringArray } from '../../../common/transforms/query.js';

/**
 * Everything that narrows the catalogue (FR-CAT-04, FR-CAT-05).
 *
 * Listing and facet counting take the *same* filter, which is why it is a class of its own
 * rather than fields on the list DTO: the counts beside each option have to be computed against
 * the identical predicate the grid uses, and two parallel definitions would drift the moment a
 * filter is added.
 *
 * Multiple values of one filter are OR'd, different filters are AND'd (FR-CAT-05). That rule
 * lives in `product-where.ts`; this class only says what may arrive.
 *
 * Values are the stable codes and slugs from the reference tables, never database ids — a URL
 * with a UUID in it is neither shareable nor readable, and FR-CAT-07 makes the URL the state.
 */
export class ProductFilterDto {
  /** Absent means both trees. Set by the route, not usually by the user. */
  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  readonly type?: (typeof PRODUCT_TYPES)[number];

  /** Category slug. Matches the category and everything beneath it, so `kits` means all kits. */
  @IsOptional()
  @IsString()
  readonly category?: string;

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsString({ each: true })
  readonly grade?: string[];

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsString({ each: true })
  readonly scale?: string[];

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsString({ each: true })
  readonly series?: string[];

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsString({ each: true })
  readonly brand?: string[];

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsIn(DIFFICULTIES, { each: true })
  readonly difficulty?: string[];

  @IsOptional()
  @ToStringArray()
  @IsArray()
  @IsIn(TOOL_JOBS, { each: true })
  readonly toolJob?: string[];

  /** Whole rupiah, inclusive, against the product's cheapest variant (PRD A2). */
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  readonly minPrice?: number;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(0)
  readonly maxPrice?: number;

  /** Only products with at least one variant a customer could buy right now. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  readonly inStock?: boolean;
}
