import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CHECKOUT_FIELD_LIMITS,
  MAX_LINES_PER_ORDER,
  MAX_QUANTITY_PER_LINE,
  PAYMENT_METHODS,
  PHONE_PATTERN,
  POSTAL_CODE_PATTERN,
  SHIPPING_TIERS,
  type PaymentMethod,
  type ShippingTier,
} from '@gunsnip/shared';
import { NormaliseEmail, NormalisePhone, Trim } from '../../../common/transforms/text.js';

/** Contact (FR-CO-03). All three are required: the courier needs the phone, the receipt the email. */
export class OrderContactDto {
  @Trim()
  @IsString()
  @Length(2, CHECKOUT_FIELD_LIMITS.name)
  readonly name!: string;

  @NormaliseEmail()
  @IsEmail()
  @MaxLength(CHECKOUT_FIELD_LIMITS.email)
  readonly email!: string;

  @NormalisePhone()
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be an Indonesian mobile number' })
  readonly phone!: string;
}

/**
 * The delivery address (FR-CO-03).
 *
 * Province, city and district arrive as **one** id — the most specific region chosen. The names
 * written onto the order are read from the region tree on the server, so a client cannot address
 * a parcel to a district that is not in the city it claims.
 */
export class OrderAddressDto {
  @IsUUID()
  readonly regionId!: string;

  @Trim()
  @IsString()
  @Matches(POSTAL_CODE_PATTERN, { message: 'postalCode must be five digits' })
  readonly postalCode!: string;

  @Trim()
  @IsString()
  @Length(5, CHECKOUT_FIELD_LIMITS.street)
  readonly street!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(CHECKOUT_FIELD_LIMITS.notes)
  readonly notes?: string;
}

/** A line as the checkout summary showed it. A variant and a count — never a price. */
export class OrderItemDto {
  @IsUUID()
  readonly variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_LINE)
  readonly quantity!: number;
}

/**
 * `POST /orders` (FR-CO-01 … FR-CO-08). Requires an `Idempotency-Key` header (FR-CO-07).
 *
 * Two fields beyond PRD §10's sketch, and one fewer:
 *
 * - `items` — the lines the summary showed. The order is still built from the actor's cart; this
 *   is how the server knows *which* of its lines the customer confirmed, and at what quantity, so
 *   a line that ran short in the meantime is refused by name (FR-CO-08) instead of silently
 *   shrinking.
 * - `expectedTotalIdr` — the total the summary showed. **Never charged** (CLAUDE.md
 *   non-negotiable #2): the order is priced from the database regardless. It only lets the server
 *   notice that the price moved between the summary and the click, and stop rather than charge a
 *   surprise.
 * - No `voucherCode`. The voucher is the one on the cart (`POST /cart/voucher`); a second place to
 *   name one would be a second source of truth about which applies.
 *
 * `shippingOptionId` is `shippingTier`: the options for an address are the tiers of its zone, so
 * the tier *is* the option's identity.
 */
export class PlaceOrderDto {
  @ValidateNested()
  @Type(() => OrderContactDto)
  readonly contact!: OrderContactDto;

  @ValidateNested()
  @Type(() => OrderAddressDto)
  readonly address!: OrderAddressDto;

  @IsIn(SHIPPING_TIERS)
  readonly shippingTier!: ShippingTier;

  /** Stored on the payment; every method resolves to the configured provider (FR-PAY-02). */
  @IsIn(PAYMENT_METHODS)
  readonly paymentMethod!: PaymentMethod;

  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LINES_PER_ORDER)
  @ArrayUnique((item: OrderItemDto) => item.variantId, { message: 'items must name each variant once' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  readonly items!: OrderItemDto[];

  @IsInt()
  @Min(0)
  readonly expectedTotalIdr!: number;
}
