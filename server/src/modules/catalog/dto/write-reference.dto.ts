import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PRODUCT_TYPES, type ProductType } from '@gunsnip/shared';

/**
 * Reference-data management (FR-ADM-09) — grades, scales, series, brands and categories.
 *
 * One DTO pair covers all five because they are the same shape: a stable key, a display name and
 * a position in the filter rail. Categories add a tree and a type; everything else is flat.
 *
 * **The stable key is not editable.** `code` and `slug` appear in every shared URL and in every
 * saved filter (FR-CAT-07), so renaming a grade changes its `name` and leaves `MG` alone. A key
 * that has to change is a new row and a redirect, not an update.
 */
export class CreateGradeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  readonly code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  readonly name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class CreateScaleDto {
  /** `1/144`, `NON_SCALE`. Not a Postgres enum — `1/144` is not a valid enum identifier. */
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  readonly code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  readonly name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class UpdateScaleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  readonly name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

/** Series and brands are the same shape: a name and a slug derived from it. */
export class CreateNamedDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  readonly slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class UpdateNamedDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  readonly slug?: string;

  /** Which storefront tree this belongs to. Kits and tools are browsed separately. */
  @IsIn(PRODUCT_TYPES)
  readonly type!: ProductType;

  @IsOptional()
  @IsUUID()
  readonly parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly name?: string;

  @IsOptional()
  @IsUUID()
  readonly parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;
}
