import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * `POST /admin/products/:id/variants` and `PATCH /admin/variants/:variantId` (FR-ADM-03).
 *
 * **Stock is not here.** A variant's price and its name are catalogue edits; its stock level is
 * an inventory movement that needs a reason and an audit row (FR-ADM-05). Letting a form save
 * both at once is exactly how a stock level ends up changed with no movement explaining it, so
 * the opening balance is the only quantity this DTO accepts and every later change goes through
 * `POST /admin/variants/:id/stock`.
 */
const SKU = /^[A-Z0-9][A-Z0-9-]*$/;

export class CreateVariantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SKU, { message: 'sku must be uppercase letters, digits and hyphens.' })
  readonly sku!: string;

  /** Shown only when the product has more than one variant. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly name?: string | null;

  /** `{ "colour": "Mr. Color 8 Silver" }` — what distinguishes this variant (PRD §5.2). */
  @IsOptional()
  @IsObject()
  readonly optionValues?: Record<string, string>;

  /** Whole rupiah (PRD A2). Never a float, never a string. */
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly priceIdr!: number;

  /** The struck-through original. Discount percent is always computed, never typed (FR-PROMO-03). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly compareAtPriceIdr?: number | null;

  /**
   * The opening balance, written as a RESTOCK movement so even a variant's first units have a
   * row explaining where they came from.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  readonly openingStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  readonly weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  readonly barcode?: string | null;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SKU, { message: 'sku must be uppercase letters, digits and hyphens.' })
  readonly sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly name?: string | null;

  @IsOptional()
  @IsObject()
  readonly optionValues?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly priceIdr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly compareAtPriceIdr?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  readonly weightGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  readonly barcode?: string | null;

  /**
   * Archived, not deleted. A variant is referenced by every order that ever bought it, and
   * FR-ORD-05 makes those snapshots permanent — so retiring one hides it from the storefront
   * and leaves history intact.
   */
  @IsOptional()
  @IsBoolean()
  readonly isArchived?: boolean;
}
