import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';

/**
 * `PATCH /cart/items/:id` — the stepper and the checkbox (FR-CART-02, FR-CART-03).
 *
 * Either field or both. An empty body is rejected rather than treated as a no-op: a client that
 * sends one has a bug, and a 200 would hide it. Quantity has no zero — removing a line is
 * `DELETE`, so "0" can never be a typo that empties a line.
 *
 * No price field, for the same reason as `AddCartItemsDto`.
 */
export class UpdateCartItemDto {
  // Required when `isSelected` is absent, optional beside it.
  @ValidateIf((dto: UpdateCartItemDto) => dto.quantity !== undefined || dto.isSelected === undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  readonly quantity?: number;

  @IsOptional()
  @IsBoolean()
  readonly isSelected?: boolean;
}
