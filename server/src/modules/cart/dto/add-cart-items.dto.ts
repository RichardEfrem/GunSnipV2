import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';

/**
 * The cap on how many distinct lines one request may add.
 *
 * "Add selected" ticks a handful of tools (FR-PDP-08), so this is generous for the real use and
 * still stops a request that would open a transaction over a thousand upserts.
 */
export const MAX_LINES_PER_ADD = 20;

export class AddCartItemDto {
  /**
   * A variant, never a product. A product with three variants has three prices, and the choice
   * of which one belongs to whoever showed the customer a price — the server (FR-PDP-04).
   */
  @IsUUID()
  readonly variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  readonly quantity!: number;
}

/**
 * Adding to the cart (FR-PDP-07, FR-PDP-08).
 *
 * An array rather than a single item because DoD §13.3 requires a nipper and a panel liner to
 * arrive in **one action** — a client looping over a single-item endpoint would be several
 * actions wearing one button, with a partial cart as its failure mode.
 *
 * There is deliberately no price field. A DTO that accepted one would be a DTO someone could
 * send a zero in (CLAUDE.md non-negotiable #2).
 */
export class AddCartItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES_PER_ADD)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  readonly items!: AddCartItemDto[];
}
