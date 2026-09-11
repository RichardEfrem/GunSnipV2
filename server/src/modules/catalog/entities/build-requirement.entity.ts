import type { Necessity } from '@gunsnip/shared';
import type { ProductSummary } from './product-summary.entity.js';

/**
 * One tool a kit needs, for the "What you'll need to build this" block (FR-PDP-08).
 *
 * The tool arrives as a full `ProductSummary` rather than a trimmed-down shape: the block
 * prints a name, a price and a stock state, which is most of a card already, and reusing the
 * card's mapper is what stops the price in this block from ever disagreeing with the price on
 * the tool's own page.
 */
export interface BuildRequirement {
  necessity: Necessity;
  /** Why, in the customer's terms: "Waterslide decals need setting solution". */
  reason: string | null;
  tool: ProductSummary;
  /**
   * The variant "Add selected" would add, chosen server-side so the client never picks one.
   * Null when nothing on the product is buyable, which is what makes the row render as
   * unavailable rather than as a checkbox that fails on submit.
   */
  variantId: string | null;
}
