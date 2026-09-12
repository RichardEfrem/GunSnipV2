import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '@gunsnip/shared';
import { ToInt } from '../../../common/transforms/query.js';

export const DEFAULT_ADMIN_ORDER_PAGE_SIZE = 25;
/** The cap CLAUDE.md requires. Above this it is a report, not a page — FR-ADM-14, deferred. */
export const MAX_ADMIN_ORDER_PAGE_SIZE = 100;

/** `GET /admin/orders` (FR-ADM-07). */
export class ListAdminOrdersDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  readonly status?: OrderStatus;

  /** Inclusive, against `placed_at`. ISO 8601; the client sends a UTC instant. */
  @IsOptional()
  @IsDateString()
  readonly placedFrom?: string;

  @IsOptional()
  @IsDateString()
  readonly placedTo?: string;

  /**
   * Order number or customer email. Email lives inside the `customer_snapshot` JSONB, so this is
   * a containment match on the JSON path rather than an indexed column — acceptable because an
   * operator searching by email does it once, not on every page load, and the status and date
   * filters have already narrowed the scan.
   */
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
  @Max(MAX_ADMIN_ORDER_PAGE_SIZE)
  readonly limit?: number;
}
