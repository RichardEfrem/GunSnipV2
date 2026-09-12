import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';

/**
 * `POST /cart/bundles` (FR-CAT-11).
 *
 * Addressed by slug, like everything else the storefront links to, and carrying no price — the
 * bundle's price is read from the database on the server (CLAUDE.md non-negotiable #2).
 */
export class AddCartBundleDto {
  @IsString()
  @MinLength(1)
  readonly slug!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  readonly quantity?: number;
}
