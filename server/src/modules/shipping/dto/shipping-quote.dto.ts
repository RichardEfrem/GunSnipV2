import { IsUUID } from 'class-validator';

/**
 * `POST /shipping/quote` (FR-CO-04).
 *
 * PRD §10 sketches `{regionId, items}`. There are no items here: the rates are flat by zone and
 * tier (A4), so a parcel's contents cannot change its price, and a field that is accepted and
 * ignored is a field someone will one day assume is honoured. When real courier rates arrive
 * (PRD Q5) the weight comes from the actor's own cart on the server — never from a list the
 * client sends.
 */
export class ShippingQuoteDto {
  @IsUUID()
  readonly regionId!: string;
}
