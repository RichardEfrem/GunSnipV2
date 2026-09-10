import type { ProductType, StockState } from '@gunsnip/shared';

/**
 * One product card (DESIGN.md §3.4).
 *
 * The card's job is to let someone discard the product without a click, so everything it needs
 * to do that is here and nothing else is: no description, no variant list, no specs. That is
 * also why `stockState` is computed on the server — availability is `stock_on_hand −
 * stock_reserved` across variants (PRD §8.3) and a client that recomputed it would be one
 * refresh behind the truth.
 */
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  type: ProductType;

  brand: LabelledRef;
  /** Kits only. Tools have no grade, which is why the card gives them a second status slot. */
  grade: CodedRef | null;
  scale: CodedRef | null;
  series: LabelledRef | null;

  image: ProductImageRef | null;

  /** The cheapest variant's price, in whole rupiah (PRD A2). */
  priceIdr: number;
  /** That same variant's struck-through original, when it has one. */
  compareAtPriceIdr: number | null;
  /** Variants differ in price, so the card reads "From Rp …" rather than quoting one of them. */
  hasPriceRange: boolean;

  stockState: StockState;
  /** Units a customer could buy right now, summed across variants. */
  availableQuantity: number;

  /** `4.8`, or null when nothing has been reviewed — never `0`, which would render as a rating. */
  ratingAverage: number | null;
  reviewCount: number;
  unitsSold: number;

  /** Published recently enough for the "New" badge (DESIGN.md §4.3). */
  isNew: boolean;
  /** ISO 8601, UTC. Formatted at the render layer in Asia/Jakarta (CLAUDE.md Conventions). */
  publishedAt: string | null;
}

export interface LabelledRef {
  name: string;
  slug: string;
}

/** Reference data the filter rail addresses by its stable code rather than by name. */
export interface CodedRef {
  code: string;
  name: string;
}

export interface ProductImageRef {
  url: string;
  /** Describes the product, never "product image" (DESIGN.md §6). */
  alt: string;
  /** Base64 data URI, so `next/image` has a placeholder without a round trip. */
  blurDataUrl: string;
}
