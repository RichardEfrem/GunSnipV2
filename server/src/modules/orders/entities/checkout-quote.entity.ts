import type { ShippingZone } from '@gunsnip/shared';
import type { CartNotice, CartVoucher } from '../../cart/entities/cart.entity.js';
import type { ProductImageRef } from '../../catalog/entities/product-summary.entity.js';
import type { ShippingOption } from '../../shipping/entities/shipping-option.entity.js';

/**
 * The checkout summary (FR-CO-04, FR-CO-05, DESIGN.md §3.7): what the order would be if it were
 * placed now, to this address, by this courier tier.
 *
 * Priced by the same `priceOrder` the order itself is written with, so the total on this screen
 * is not an estimate of the charge — it is the charge, computed a second early. The client sends
 * `totals.totalIdr` back with the order only so the server can notice if it moved in between.
 */
export interface CheckoutQuote {
  lines: readonly CheckoutLine[];
  /** Selected lines that cannot be bought right now and will stay in the cart. */
  unavailableCount: number;
  /** The cart's voucher, judged against *this* order — real shipping included. */
  voucher: CartVoucher | null;
  /** Null until the customer has chosen at least a province. */
  delivery: CheckoutDelivery | null;
  totals: CheckoutTotals;
}

export interface CheckoutLine {
  /**
   * The cart line this quotes. What `POST /orders` sends back to confirm it (FR-CO-08) — a
   * variant id no longer identifies one line, because a bundle can put the same variant in the
   * cart twice at a different price (FR-CAT-11).
   */
  cartLineId: string;
  variantId: string;
  /** Set when this line is part of a bundle, so the summary can group and name it. */
  bundle: { id: string; name: string; slug: string } | null;
  sku: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  image: ProductImageRef | null;
  /** What will be ordered — never more than exists. */
  quantity: number;
  unitPriceIdr: number;
  lineTotalIdr: number;
  notices: readonly CartNotice[];
}

export interface CheckoutDelivery {
  regionId: string;
  zone: ShippingZone | null;
  /**
   * Whether the chosen region is specific enough to ship to. A province is enough to show rates;
   * an order needs the district (or the city, where no districts are listed).
   */
  isComplete: boolean;
  /** Cheapest first. Empty when nothing delivers to this zone. */
  options: readonly ShippingOption[];
  /**
   * The option priced into the totals: the one asked for when this zone offers it, otherwise the
   * cheapest — so moving from Jakarta to Bandung quietly falls back from same-day to regular
   * rather than quoting a tier Bandung does not have.
   */
  selected: ShippingOption | null;
}

export interface CheckoutTotals {
  subtotalIdr: number;
  discountIdr: number;
  /** Zero until a delivery option is selected. */
  shippingIdr: number;
  totalIdr: number;
  /** Units across the lines — "4 items". */
  itemCount: number;
}
