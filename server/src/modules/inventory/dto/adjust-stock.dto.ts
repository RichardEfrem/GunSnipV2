import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength, NotEquals } from 'class-validator';
import { INVENTORY_MOVEMENT_REASONS, type InventoryMovementReason } from '@gunsnip/shared';

/**
 * `POST /admin/variants/:variantId/stock` (FR-ADM-05).
 *
 * A signed delta rather than a new total: two operators counting the same shelf minutes apart
 * both mean "add six", and sending totals would have the second silently undo the first.
 */
export class AdjustStockDto {
  @IsInt()
  @NotEquals(0, { message: 'delta must be a non-zero whole number.' })
  readonly delta!: number;

  /** Required — FR-ADM-05 makes the reason mandatory, which is what makes the log readable. */
  @IsIn(INVENTORY_MOVEMENT_REASONS)
  readonly reason!: InventoryMovementReason;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly note?: string;
}
