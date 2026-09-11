import type { StockState } from '@gunsnip/shared';
import type { ProductImageRef } from '../../catalog/entities/product-summary.entity.js';

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
  totals: CartTotals;
}

export interface CartLine {
  id: string;
  quantity: number;
  /** Unselected lines stay in the cart and are excluded from the total (FR-CART-03). */
  isSelected: boolean;

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

export interface CartTotals {
  /** Selected lines only (FR-CART-03). */
  subtotalIdr: number;
  /** Lines in the cart, selected or not. */
  lineCount: number;
  /** Units across selected lines — what the header badge counts. */
  selectedQuantity: number;
}
