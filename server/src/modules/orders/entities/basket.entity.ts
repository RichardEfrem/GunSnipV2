import type { ProductImageRef } from '../../catalog/entities/product-summary.entity.js';
import type { VoucherTerms } from '../../vouchers/entities/voucher-terms.entity.js';

/**
 * The actor's cart as checkout reads it: only the **selected** lines, each with its variant's
 * state at the moment of reading. When placing an order, that moment is after the variant rows
 * are locked `FOR UPDATE`, so the stock and price here are the ones the order is written against.
 */
export interface Basket {
  cartId: string;
  lines: readonly BasketLine[];
  /** The cart's voucher, when it has one — applied or not is decided by the rules, not here. */
  voucher: BasketVoucher | null;
}

export interface BasketLine {
  cartLineId: string;
  /** What the cart row holds — the customer's request, which may be more than exists. */
  requestedQuantity: number;
  priceAtAddIdr: number;

  variantId: string;
  sku: string;
  variantName: string | null;
  /** The variant's price now, in whole rupiah. The only price an order is ever charged. */
  unitPriceIdr: number;
  stockOnHand: number;
  stockReserved: number;
  /** False for an archived variant or an unpublished product. */
  isSellable: boolean;

  productId: string;
  productName: string;
  productSlug: string;
  /** The product's category and its parent — what voucher scope matches on (FR-PROMO-02). */
  categoryIds: readonly string[];
  image: ProductImageRef | null;
}

export interface BasketVoucher {
  terms: VoucherTerms;
  /** Placed orders this actor has already used it on — the per-session limit (FR-PROMO-02). */
  sessionRedemptions: number;
}
