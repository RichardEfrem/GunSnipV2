import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToInt } from '../../../common/transforms/query.js';

/** The cap CLAUDE.md requires on every list endpoint. */
export const MAX_MOVEMENT_PAGE_SIZE = 100;
export const DEFAULT_MOVEMENT_PAGE_SIZE = 25;

/** `GET /admin/variants/:variantId/movements` — the audit trail, newest first. */
export class ListMovementsDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(MAX_MOVEMENT_PAGE_SIZE)
  readonly limit?: number;
}
