import type { ProductType } from '@gunsnip/shared';

/**
 * Reference data as the back office sees it (FR-ADM-09).
 *
 * `ReferenceOption` — the storefront's shape — is `{ id, value, label }`, everything the filter
 * rail needs and nothing more. An operator needs the fields they can edit, and `usageCount`,
 * which is what makes deletion a decision rather than a surprise: a grade with 40 kits behind it
 * is not one you remove by accident.
 */
export interface AdminReferenceItem {
  id: string;
  /** The stable key that appears in URLs — `code` for grades and scales, `slug` elsewhere. */
  key: string;
  name: string;
  description: string | null;
  position: number;
  /** How many products point at this row. */
  usageCount: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  parentId: string | null;
  position: number;
  usageCount: number;
  /** Depth in the tree, root being 0 — so the screen can indent without rebuilding the tree. */
  depth: number;
}
