import { toStockState } from '../catalog/product-mapper.js';
import type { ShippingEstimate } from '../shipping/entities/shipping-estimate.entity.js';
import type { VoucherBasket, VoucherEvaluation } from '../vouchers/entities/voucher-evaluation.entity.js';
import type { VoucherTerms } from '../vouchers/entities/voucher-terms.entity.js';
import { countedLines, lineTotal, totalsFor } from './cart-pricing.js';
import { revalidateLine } from './cart-revalidation.js';
import type { CartLine, CartVoucher, CartView } from './entities/cart.entity.js';
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

export function toCartLine(row: CartLineRow): CartLine {
  const { variant } = row;
  const { product } = variant;
  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  const image = product.images[0];

  const { quantity, isPurchasable, notices } = revalidateLine({
    requestedQuantity: row.quantity,
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

    unitPriceIdr: variant.priceIdr,
    lineTotalIdr: lineTotal(variant.priceIdr, quantity),

    stockState: toStockState(available),
    availableQuantity: available,
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
