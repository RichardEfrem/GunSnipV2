import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VOUCHER_TYPES, type VoucherType } from '@gunsnip/shared';
import { ToInt } from '../../../common/transforms/query.js';

/**
 * Voucher CRUD (FR-ADM-10).
 *
 * `percentOff` and `amountIdr` are both optional here because which one is required depends on
 * `type` — a rule the DTO cannot express and `VoucherAdminService` enforces. Two nullable
 * columns rather than one polymorphic `value` is the schema's choice for the same reason it is
 * the right one here: a percentage can never be mistaken for rupiah.
 *
 * `usedCount` is absent and always will be. It is a counter the order transaction owns; an
 * endpoint that let an operator type it would let them hand out a used-up voucher again.
 */
const VOUCHER_CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export class CreateVoucherDto {
  @IsString()
  @Matches(VOUCHER_CODE, { message: 'code must be 3–32 uppercase letters, digits or hyphens.' })
  readonly code!: string;

  @IsIn(VOUCHER_TYPES)
  readonly type!: VoucherType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly description?: string | null;

  /** PERCENTAGE only. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly percentOff?: number | null;

  /** FIXED_AMOUNT: the amount off. FREE_SHIPPING: an optional cap on the shipping waived. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly amountIdr?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly minSpendIdr?: number | null;

  /** Caps a percentage voucher. Meaningless on a fixed amount, which is already its own cap. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly maxDiscountIdr?: number | null;

  @IsDateString()
  readonly startsAt!: string;

  @IsDateString()
  readonly endsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  readonly usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly perSessionLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  /** Both empty means the whole catalogue. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  readonly categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  readonly productIds?: string[];
}

/** The code is not editable: it is printed on a campaign and typed by customers. */
export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly percentOff?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly amountIdr?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly minSpendIdr?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  readonly maxDiscountIdr?: number | null;

  @IsOptional()
  @IsDateString()
  readonly startsAt?: string;

  @IsOptional()
  @IsDateString()
  readonly endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  readonly usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  readonly perSessionLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  readonly categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  readonly productIds?: string[];
}

export const DEFAULT_VOUCHER_PAGE_SIZE = 25;
export const MAX_VOUCHER_PAGE_SIZE = 100;

export class ListVouchersDto {
  /** Whether the voucher is switched on — not whether it is currently within its window. */
  @IsOptional()
  @IsIn(['true', 'false'])
  readonly isActive?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  readonly q?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_VOUCHER_PAGE_SIZE)
  readonly limit?: number;
}
