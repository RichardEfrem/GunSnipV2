/**
 * The filter rail's options and their counts (FR-CAT-10).
 *
 * Every option that exists in the current scope is returned, including the ones that would
 * yield nothing — the client renders those disabled rather than hiding them, because options
 * that vanish make the filter set feel unstable (DESIGN.md §3.2). A zero count is therefore
 * information, not something to filter out here.
 *
 * `total` is the count the grid will show and the number the mobile sheet's "Show N kits"
 * button prints while options are still being ticked (DESIGN.md §3.3) — which is the reason
 * facets are their own endpoint rather than a field on the listing response: the sheet needs to
 * ask "what would this give me" without replacing the results behind it.
 */
export interface Facets {
  total: number;

  grades: readonly FacetOption[];
  scales: readonly FacetOption[];
  series: readonly FacetOption[];
  brands: readonly FacetOption[];
  difficulties: readonly FacetOption[];
  toolJobs: readonly FacetOption[];

  /** In-stock is a toggle rather than a list, so it carries just its count. */
  inStockCount: number;

  /** The price range available under the *other* filters, which is what the slider spans. */
  price: PriceBounds;
}

export interface FacetOption {
  /** The value that goes in the URL — a code or a slug, never an id (FR-CAT-07). */
  value: string;
  label: string;
  count: number;
  /** Whether this option is currently applied, so the rail does not track it separately. */
  isSelected: boolean;
}

export interface PriceBounds {
  /** Whole rupiah. Both are 0 when nothing matches. */
  minIdr: number;
  maxIdr: number;
}
