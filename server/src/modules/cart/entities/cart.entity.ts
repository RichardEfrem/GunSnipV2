import type { CartNoticeKind, StockState, VoucherType } from '@gunsnip/shared';
import type { ProductImageRef } from '../../catalog/entities/product-summary.entity.js';
import type { ShippingEstimate } from '../../shipping/entities/shipping-estimate.entity.js';
import type { VoucherRejection } from '../../vouchers/entities/voucher-evaluation.entity.js';

/**
 * The cart as the storefront renders it (DESIGN.md §3.6).
 *
 * **Every money field here is computed from the database on the way out** (CLAUDE.md
 * non-negotiable #2). Nothing a client sent is echoed back as a price, which is why the line
 * carries `unitPriceIdr` — the variant's price *now* — rather than the `price_at_add_idr` the
 * row stores. That column exists to detect a change and say so (FR-CART-04), never to charge.
 */
export interface CartView {
  id: string;
  lines: readonly CartLine[];
  /** The voucher attached to the cart, applied or not (FR-CART-06, FR-PROMO-05: one at most). */
  voucher: CartVoucher | null;
  /**
   * What `totals.shippingIdr` is based on — the cheapest regular rate, since the cart has no
   * address yet. Present even when nothing is selected, so the summary can still say "from".
   */
  shippingEstimate: ShippingEstimate | null;
  totals: CartTotals;
}

export interface CartLine {
  id: string;
  /** What the line counts as: the customer's quantity, reduced to what exists (FR-CART-04). */
  quantity: number;
  /** Unselected lines stay in the cart and are excluded from the total (FR-CART-03). */
  isSelected: boolean;
  /**
   * False when the line cannot be bought — out of stock, archived, unpublished. Such a line
   * stays in the cart as a shortlist entry and never counts towards a total, selected or not.
   */
  isPurchasable: boolean;
  /** What changed since the line was added. Empty when nothing did (FR-CART-04). */
  notices: readonly CartNotice[];

  variantId: string;
  sku: string;
  /** Null when the product has a single variant and the name would be noise. */
  variantName: string | null;
  optionValues: Record<string, string>;

  productSlug: string;
  productName: string;
  image: ProductImageRef | null;

  /** The variant's price right now, in whole rupiah (PRD A2). */
  unitPriceIdr: number;
  /** `unitPriceIdr × quantity`. Computed server-side, never summed in the browser. */
  lineTotalIdr: number;

  stockState: StockState;
  availableQuantity: number;
}

/** See `CART_NOTICE_KINDS` in `@gunsnip/shared` for what each one means. */
export type CartNotice =
  | { kind: 'PRICE_CHANGED'; previousUnitPriceIdr: number }
  | { kind: 'QUANTITY_REDUCED'; requestedQuantity: number }
  | { kind: Exclude<CartNoticeKind, 'PRICE_CHANGED' | 'QUANTITY_REDUCED'> };

/**
 * A voucher on the cart. It stays attached when it stops qualifying — deselecting a line can
 * drop the cart below a minimum spend — and says why, rather than vanishing: reselecting the
 * line brings the discount back, which a silently removed voucher could not do.
 */
export interface CartVoucher {
  code: string;
  type: VoucherType;
  description: string | null;
  isApplied: boolean;
  /** Zero unless applied. */
  discountIdr: number;
  /** Null when applied. */
  rejection: VoucherRejection | null;
}

/**
 * The order summary (FR-CART-05). Only lines that are selected **and** purchasable count, and
 * `totalIdr = subtotalIdr − discountIdr + shippingIdr` — the same three columns an order stores,
 * so checkout can carry these across without reinterpreting them.
 */
export interface CartTotals {
  subtotalIdr: number;
  discountIdr: number;
  /** The estimate; zero when nothing counts, since there is nothing to ship. */
  shippingIdr: number;
  totalIdr: number;
  /** Lines in the cart, selected or not — the header badge and "Cart (4 items)". */
  lineCount: number;
  /** Units across the lines that count — "Subtotal (3 items)". */
  selectedQuantity: number;
}
