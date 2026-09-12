import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { SHIPPING_TIERS, type ShippingTier } from '@gunsnip/shared';

/**
 * `POST /checkout/quote` — price the actor's selected lines for an address and a tier.
 *
 * Both optional: checkout opens before the customer has typed an address, and the summary still
 * has lines and a subtotal to show. A tier the region's zone does not offer is not an error; the
 * quote falls back to the cheapest tier that is offered and says which one it used.
 */
export class CheckoutQuoteDto {
  @IsOptional()
  @IsUUID()
  readonly regionId?: string;

  @IsOptional()
  @IsIn(SHIPPING_TIERS)
  readonly shippingTier?: ShippingTier;
}
