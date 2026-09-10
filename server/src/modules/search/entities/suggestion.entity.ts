import type { ProductImageRef } from '../../catalog/entities/product-summary.entity.js';

/**
 * The autosuggest panel (FR-SRCH-03).
 *
 * Products carry a thumbnail and a price because the panel's job is to end the search — someone
 * who can see the kit and what it costs clicks it instead of pressing Enter and reading a
 * results page. Categories sit below them for the queries a product can never answer well
 * ("nippers" is a shelf, not an item).
 *
 * Neither list is a `ProductSummary`. A dropdown row has no use for stock state, ratings or
 * variants, and sending them would make the most latency-sensitive request in the store the
 * heaviest one.
 */
export interface Suggestions {
  /** Echoed so a late response can be matched to the keystroke that asked for it. */
  query: string;
  products: readonly ProductSuggestion[];
  categories: readonly CategorySuggestion[];
}

export interface ProductSuggestion {
  id: string;
  slug: string;
  name: string;
  /** The cheapest sellable variant, whole rupiah (PRD A2). */
  priceIdr: number;
  image: ProductImageRef | null;
}

export interface CategorySuggestion {
  name: string;
  slug: string;
  productCount: number;
}
