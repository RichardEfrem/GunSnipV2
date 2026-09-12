import { bundleSavingIdr } from '../catalog/bundle-allocation.js';
import { toStockState } from '../catalog/product-mapper.js';
import type { ShippingEstimate } from '../shipping/entities/shipping-estimate.entity.js';
import type { VoucherBasket, VoucherEvaluation } from '../vouchers/entities/voucher-evaluation.entity.js';
import type { VoucherTerms } from '../vouchers/entities/voucher-terms.entity.js';
import { groupCartRows, type BundleGroup } from './cart-grouping.js';
import { countedLines, lineTotal, totalsFor } from './cart-pricing.js';
import { revalidateLine } from './cart-revalidation.js';
import type { CartLine, CartLineBundle, CartVoucher, CartView } from './entities/cart.entity.js';
import type { CartLineRow } from './cart.repository.js';

/**
 * Cart rows to the shape the storefront renders.
 *
 * The one rule it enforces is the important one: `unitPriceIdr` comes from the **variant**, not
 * from `price_at_add_idr` (CLAUDE.md non-negotiable #2). A price the customer saw an hour ago
 * is history, not an amount to charge. The stored column is read only to say that it changed.
 */

/** Everything a view is assembled from, decided by the service before any of it is shaped. */
export interface CartParts {
  id: string;
  lines: readonly CartLine[];
  shippingEstimate: ShippingEstimate | null;
  shippingIdr: number;
  voucher: CartVoucher | null;
}

export function toCartView(parts: CartParts): CartView {
  return {
    id: parts.id,
    lines: parts.lines,
    voucher: parts.voucher,
    shippingEstimate: parts.shippingEstimate,
    totals: totalsFor(parts.lines, {
      shippingIdr: parts.shippingIdr,
      discountIdr: parts.voucher?.discountIdr ?? 0,
    }),
  };
}

/** An actor with no cart row yet still gets a cart — an empty one, not a 404. */
export function emptyCart(): CartView {
  return { id: '', lines: [], voucher: null, shippingEstimate: null, totals: totalsFor([]) };
}

/**
 * Every row as a line, in the order the cart stores them (FR-CAT-11).
 *
 * Bundle components are priced at their *allocated* share of the bundle rather than at their
 * catalogue price, so the subtotal is the sum of the bundle prices the customer was shown. The
 * grouping is worked out once, here, because a component's price cannot be known without seeing
 * its siblings.
 */
export function toCartLines(rows: readonly CartLineRow[]): CartLine[] {
  const { groups } = groupCartRows(rows);

  const groupByRowId = new Map<string, { group: BundleGroup<CartLineRow>; allocatedUnitPriceIdr: number }>();
  for (const group of groups) {
    for (const member of group.rows) {
      groupByRowId.set(member.row.id, { group, allocatedUnitPriceIdr: member.allocatedUnitPriceIdr });
    }
  }

  return rows.map((row) => {
    const member = groupByRowId.get(row.id);

    return member === undefined
      ? toCartLine(row)
      : toCartLine(row, member.allocatedUnitPriceIdr, member.group);
  });
}

/**
 * One row as a line.
 *
 * `unitPriceIdr` is the variant's price now (CLAUDE.md non-negotiable #2) — except for a bundle
 * component, whose price is its allocated share of the bundle. Both come from the database; the
 * stored `price_at_add_idr` is read only to say that something changed (FR-CART-04).
 */
export function toCartLine(
  row: CartLineRow,
  allocatedUnitPriceIdr?: number,
  group?: BundleGroup<CartLineRow>,
): CartLine {
  const { variant } = row;
  const { product } = variant;
  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  const image = product.images[0];
  const unitPriceIdr = allocatedUnitPriceIdr ?? variant.priceIdr;

  const { quantity, isPurchasable, notices } = revalidateLine({
    requestedQuantity: row.quantity,
    // A bundle component is compared on its catalogue price, not its allocated one: what
    // FR-CART-04 surfaces is the *product* getting more expensive, and the allocated figure
    // moves whenever a sibling's price moves, which would raise a notice about the wrong thing.
    unitPriceIdr: variant.priceIdr,
    priceAtAddIdr: row.priceAtAddIdr,
    availableQuantity: available,
    isSellable: !variant.isArchived && product.status === 'PUBLISHED',
  });

  return {
    id: row.id,
    quantity,
    isSelected: row.isSelected,
    isPurchasable,
    notices,

    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.name,
    optionValues: toOptionValues(variant.optionValues),

    productSlug: product.slug,
    productName: product.name,
    image:
      image === undefined
        ? null
        : { url: image.url, alt: image.alt, blurDataUrl: image.blurDataUrl },

    unitPriceIdr,
    lineTotalIdr: lineTotal(unitPriceIdr, quantity),

    stockState: toStockState(available),
    availableQuantity: available,

    bundle: group === undefined ? null : toCartLineBundle(group),
  };
}

function toCartLineBundle(group: BundleGroup<CartLineRow>): CartLineBundle {
  return {
    id: group.bundleId,
    slug: group.slug,
    name: group.name,
    quantity: group.quantity,
    unitPriceIdr: group.unitPriceIdr,
    groupTotalIdr: group.unitPriceIdr * group.quantity,
    savingIdr: bundleSavingIdr(
      group.unitPriceIdr,
      group.rows.map((member) => ({
        variantId: member.row.variant.id,
        quantity: member.perBundleQuantity,
        catalogueUnitPriceIdr: member.row.variant.priceIdr,
      })),
    ),
  };
}

/**
 * What a voucher is checked against: the lines that count, with the product and categories
 * scope is matched on (FR-PROMO-02). Lines are matched to rows by id, since the view line no
 * longer carries the catalogue ids the scope needs.
 */
export function toVoucherBasket(
  rows: readonly CartLineRow[],
  lines: readonly CartLine[],
  shippingIdr: number,
): VoucherBasket {
  const rowsById = new Map(rows.map((row) => [row.id, row]));

  return {
    shippingIdr,
    lines: countedLines(lines).flatMap((line) => {
      const product = rowsById.get(line.id)?.variant.product;
      if (product === undefined) return [];

      return [
        {
          productId: product.id,
          categoryIds: [product.category.id, product.category.parentId].filter(
            (id): id is string => id !== null,
          ),
          lineTotalIdr: line.lineTotalIdr,
        },
      ];
    }),
  };
}

export function toCartVoucher(terms: VoucherTerms, evaluation: VoucherEvaluation): CartVoucher {
  const base = { code: terms.code, type: terms.type, description: terms.description };

  return evaluation.isValid
    ? { ...base, isApplied: true, discountIdr: evaluation.discountIdr, rejection: null }
    : { ...base, isApplied: false, discountIdr: 0, rejection: evaluation.rejection };
}

/**
 * `option_values` is JSONB, so Prisma types it as a union including null and arrays. Narrowing
 * rather than casting means a malformed row renders as a line with no options instead of
 * throwing a cart away.
 */
function toOptionValues(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
