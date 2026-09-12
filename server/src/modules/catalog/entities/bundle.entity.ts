import type { StockState } from '@gunsnip/shared';
import type { ProductImageRef } from './product-summary.entity.js';

/**
 * A curated bundle as the storefront renders it (FR-CAT-11).
 *
 * The price is the bundle's own; `savingIdr` is the difference against buying the components
 * separately, computed rather than typed by an operator — the same rule `compare_at_price`
 * follows on a product (FR-PROMO-03), for the same reason: a hand-typed saving is a claim that
 * goes stale the moment a component is repriced.
 */
export interface BundleSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceIdr: number;
  /** What the components cost bought separately. Null when there is no saving to show. */
  compareAtPriceIdr: number | null;
  savingIdr: number;
  /** Zero when any component is out of stock — a bundle is only as available as its scarcest part. */
  availableQuantity: number;
  stockState: StockState;
  isPurchasable: boolean;
  image: ProductImageRef | null;
  components: readonly BundleComponentView[];
}

export interface BundleComponentView {
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  variantName: string | null;
  sku: string;
  /** What this component costs on its own — what the bundle is being compared against. */
  catalogueUnitPriceIdr: number;
  availableQuantity: number;
  image: ProductImageRef | null;
}
