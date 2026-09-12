import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '@gunsnip/shared';

/**
 * `POST /admin/orders/:orderNumber/status` (FR-ADM-08).
 *
 * The target status, not a verb. The state machine (PRD §8.1) already says which moves are legal
 * from where, and an endpoint named "advance" would need its own idea of what comes next — a
 * second copy of the map, and the one that drifts.
 */
export class AdvanceOrderDto {
  @IsIn(ORDER_STATUSES)
  readonly status!: OrderStatus;

  /** Goes on the `order_event` row, which is the record of why (FR-ORD-06). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}

/** `POST /admin/orders/:orderNumber/cancel` — cancelling needs a reason, advancing does not. */
export class CancelOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  readonly reason!: string;
}

/** `PUT /admin/orders/:orderNumber/shipment` (FR-ADM-08). */
export class SetShipmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  readonly courier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  readonly trackingNumber?: string | null;
}

/** `PUT /admin/orders/:orderNumber/note` — internal, never shown to the customer. */
export class SetInternalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly internalNote?: string | null;
}
