import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DECAL_TYPES,
  DIFFICULTIES,
  PRODUCT_TYPES,
  TOOL_JOBS,
  type DecalType,
  type Difficulty,
  type ProductType,
  type ToolJob,
} from '@gunsnip/shared';

/**
 * `POST /admin/products` and `PATCH /admin/products/:id` (FR-ADM-02).
 *
 * **Type-aware by validation, not by two endpoints.** FR-ADM-02 asks for kit fields and tool
 * fields to be different forms; the transport is one shape with both groups optional, and
 * `ProductAdminService` enforces which group may be set for the chosen `type`. Putting that rule
 * in the service rather than in two DTOs is what stops a tool quietly acquiring a `runnerCount`
 * the filter rail will never show.
 *
 * `status` is absent on purpose. Publishing is its own endpoint because it is a different act
 * with a different consequence — a field edit and "this is now live on the storefront" should
 * not be the same button, and `publishedAt` has to be stamped exactly once.
 */
export class KitFieldsDto {
  @IsOptional()
  @IsUUID()
  readonly gradeId?: string | null;

  @IsOptional()
  @IsUUID()
  readonly scaleId?: string | null;

  @IsOptional()
  @IsUUID()
  readonly seriesId?: string | null;

  /** The mobile suit — "RX-78-2 Gundam". Distinct from the product name (PRD §5.1). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly unitName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly unitCode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  readonly runnerCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50_000)
  readonly partCount?: number | null;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  readonly difficulty?: Difficulty | null;

  @IsOptional()
  @IsIn(DECAL_TYPES)
  readonly decalType?: DecalType | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly articulationNotes?: string | null;

  /** Weapons, stands, extra hands. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  readonly includes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  readonly releaseYear?: number | null;

  /** Box estimate in minutes, powering the "a weekend, if you're quick" copy. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  readonly runtimeMinutesEst?: number | null;
}

export class ToolFieldsDto {
  @IsOptional()
  @IsIn(TOOL_JOBS)
  readonly toolJob?: ToolJob | null;

  /**
   * Grit number, paint code, blade angle — the long-tail specs that differ per tool line
   * (PRD §5.1). Free-form because no fixed column set covers a nipper and a paint bottle, and
   * GIN-indexed so "every 600-grit sanding stick" is still a query.
   */
  @IsOptional()
  @IsObject()
  readonly attributes?: Record<string, unknown>;
}

export class CreateProductDto {
  @IsIn(PRODUCT_TYPES)
  readonly type!: ProductType;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  readonly name!: string;

  /** Derived from the name when absent, then made unique. Never re-derived on a rename. */
  @IsOptional()
  @IsString()
  @MaxLength(96)
  readonly slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  readonly description?: string | null;

  @IsUUID()
  readonly brandId!: string;

  @IsUUID()
  readonly categoryId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  readonly tags?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => KitFieldsDto)
  readonly kit?: KitFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToolFieldsDto)
  readonly tool?: ToolFieldsDto;

  /**
   * Copy the grade's curated tool defaults onto the new kit (PRD §5.3). Defaults to true,
   * because a kit created without its nipper requirement is the common mistake and re-adding
   * them by hand is the tedious one.
   */
  @IsOptional()
  @IsBoolean()
  readonly applyGradeDefaults?: boolean;
}

/**
 * Every field optional, and `null` distinct from absent: absent leaves a column alone, `null`
 * clears it. Without that distinction there is no way to remove a scale from a kit that should
 * never have had one.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  readonly name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  readonly slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  readonly description?: string | null;

  @IsOptional()
  @IsUUID()
  readonly brandId?: string;

  @IsOptional()
  @IsUUID()
  readonly categoryId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  readonly tags?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => KitFieldsDto)
  readonly kit?: KitFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToolFieldsDto)
  readonly tool?: ToolFieldsDto;
}
