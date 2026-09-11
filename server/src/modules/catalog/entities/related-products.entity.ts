import type { ProductSummary } from './product-summary.entity.js';

/**
 * The rails below the product page (FR-PDP-10, DESIGN.md §3.5).
 *
 * Two named groups rather than one blended list, because the two answer different questions:
 * "also available as" is the same robot at another grade — the customer already wants *this*
 * unit and is choosing a size and a budget — while "from the same series" is a different robot
 * entirely. Merging them into one "related" rail would lose that, and the labels are the whole
 * value of the rail.
 *
 * FR-PDP-10 also names "frequently bought together". That is derived from order history, and
 * no order exists before Phase 7 — a version computed from anything else would be a guess
 * wearing the label of a measurement, so the field is absent rather than faked. It lands as a
 * third group here when there is data behind it.
 */
export interface RelatedProducts {
  /** The same unit at other grades — "also available as MG, RG". */
  sameUnit: readonly ProductSummary[];
  sameSeries: readonly ProductSummary[];
}
