import type { ProductType } from '@gunsnip/shared';

/**
 * The two-level navigation tree (FR-CAT-02): Kits and Tools, each with its children.
 *
 * Two levels exactly. A deeper menu is a sign the taxonomy is wrong, and the header dropdown
 * has nowhere to put a third.
 *
 * `productCount` counts published products in the category *and* its descendants, so the root
 * rows are not all zero — every product hangs off a leaf.
 */
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  productCount: number;
  children: readonly CategoryNode[];
}

/** A single page's worth of category context — the listing header and its breadcrumbs. */
export interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  /** Root first, this category last (FR-CAT-03). */
  breadcrumbs: readonly CategoryCrumb[];
}

export interface CategoryCrumb {
  name: string;
  slug: string;
}
