import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Banner and home-rail curation (FR-ADM-12, FR-PROMO-04).
 *
 * `href` must be a site-relative path. A banner is shop chrome pointing at shop pages; allowing
 * an absolute URL would make the home page a place an operator — or anyone who reached the
 * admin — could point at an arbitrary origin.
 */
const SITE_PATH = /^\/[^\s]*$/;

export class CreateBannerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly subtitle?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly imageUrl!: string;

  /** Describes the banner, never "banner image" (DESIGN.md §6). */
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  readonly alt!: string;

  @IsString()
  @Matches(SITE_PATH, { message: 'href must be a path on this site, starting with /.' })
  @MaxLength(500)
  readonly href!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;

  /** Absent means "from now". A scheduled banner is the point of FR-PROMO-04. */
  @IsOptional()
  @IsDateString()
  readonly startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  readonly endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly imageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  readonly alt?: string;

  @IsOptional()
  @IsString()
  @Matches(SITE_PATH, { message: 'href must be a path on this site, starting with /.' })
  @MaxLength(500)
  readonly href?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readonly position?: number;

  @IsOptional()
  @IsDateString()
  readonly startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  readonly endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}
