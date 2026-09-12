import { allocateBundlePrice } from '../catalog/bundle-allocation.js';

/**
 * Turning cart rows into the lines a customer sees (FR-CAT-11).
 *
 * A bundle is one line to the customer and one row per component underneath, so anything reading
 * the cart has to put them back together — and price them at the bundle's price rather than at
 * the sum of what their components fetch separately.
 *
 * Generic over the row, because two places read cart rows and must agree to the rupiah: the cart
 * view, and the basket checkout is priced from. They select different columns; what they share is
 * the shape this file needs, and sharing the *arithmetic* is the point — a second implementation
 * here would be a second opinion about what a bundle costs.
 *
 * Pure, so the allocation can be tested without a database.
 */
export interface GroupableRow {
  id: string;
  /** `perBundleQuantity × bundles` for a bundled row; the plain quantity otherwise. */
  quantity: number;
  variant: { id: string; priceIdr: number };
  bundle: GroupableBundle | null;
}

export interface GroupableBundle {
  id: string;
  slug: string;
  name: string;
  priceIdr: number;
  items: readonly { variantId: string; quantity: number }[];
}

export interface BundleGroup<Row extends GroupableRow> {
  bundleId: string;
  slug: string;
  name: string;
  /** How many of this bundle the cart holds. */
  quantity: number;
  /** What one bundle costs — the advertised price, less any rupiah that could not be split. */
  unitPriceIdr: number;
  rows: readonly BundleGroupRow<Row>[];
}

export interface BundleGroupRow<Row extends GroupableRow> {
  row: Row;
  /** This component's share of one bundle, per unit of the component. */
  allocatedUnitPriceIdr: number;
  /** How many of this component go into one bundle. */
  perBundleQuantity: number;
}

export interface GroupedCart<Row extends GroupableRow> {
  /** Rows with no bundle — ordinary lines, one per row. */
  standalone: readonly Row[];
  groups: readonly BundleGroup<Row>[];
}

export function groupCartRows<Row extends GroupableRow>(rows: readonly Row[]): GroupedCart<Row> {
  const standalone: Row[] = [];
  const byBundle = new Map<string, Row[]>();

  for (const row of rows) {
    if (row.bundle === null) {
      standalone.push(row);
      continue;
    }

    const siblings = byBundle.get(row.bundle.id);
    if (siblings === undefined) byBundle.set(row.bundle.id, [row]);
    else siblings.push(row);
  }

  return {
    standalone,
    groups: [...byBundle.values()].flatMap((siblings) => toGroup(siblings) ?? []),
  };
}

/**
 * Every row's allocated unit price, keyed by row id — the one lookup both readers need.
 *
 * A row with no bundle is absent, and its caller falls back to the variant's own price.
 */
export function allocatedPricesByRowId(rows: readonly GroupableRow[]): Map<string, number> {
  const prices = new Map<string, number>();

  for (const group of groupCartRows(rows).groups) {
    for (const member of group.rows) prices.set(member.row.id, member.allocatedUnitPriceIdr);
  }

  return prices;
}

function toGroup<Row extends GroupableRow>(rows: readonly Row[]): BundleGroup<Row> | null {
  const first = rows[0];
  if (first?.bundle == null) return null;

  const { bundle } = first;
  const perBundle = new Map(bundle.items.map((item) => [item.variantId, item.quantity]));
  const quantityOf = (row: Row): number => Math.max(1, perBundle.get(row.variant.id) ?? 1);

  const allocation = allocateBundlePrice(
    bundle.priceIdr,
    rows.map((row) => ({
      variantId: row.variant.id,
      quantity: quantityOf(row),
      catalogueUnitPriceIdr: row.variant.priceIdr,
    })),
  );

  const allocatedByVariant = new Map(
    allocation.components.map((component) => [component.variantId, component.unitPriceIdr]),
  );

  return {
    bundleId: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    quantity: bundleCount(rows, quantityOf),
    unitPriceIdr: allocation.chargedPriceIdr,
    rows: rows.map((row) => ({
      row,
      allocatedUnitPriceIdr: allocatedByVariant.get(row.variant.id) ?? 0,
      perBundleQuantity: quantityOf(row),
    })),
  };
}

/**
 * How many bundles the group holds.
 *
 * Each row stores `perBundleQuantity × bundles`, so dividing recovers the count. The **minimum**
 * is taken rather than the first, because a component whose stock ran short is clamped down by
 * revalidation (FR-CART-04): a group holding two bundles' worth of everything but one component
 * is a group the customer can only be sold one of, and quoting two would promise a bundle that
 * cannot be shipped.
 */
function bundleCount<Row extends GroupableRow>(
  rows: readonly Row[],
  quantityOf: (row: Row) => number,
): number {
  return Math.max(1, Math.min(...rows.map((row) => Math.floor(row.quantity / quantityOf(row)))));
}
