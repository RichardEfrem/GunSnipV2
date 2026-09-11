import { toStockState } from '../catalog/product-mapper.js';
import { lineTotal, totalsFor } from './cart-pricing.js';
import type { CartLine, CartView } from './entities/cart.entity.js';
import type { CartLineRow, CartRow } from './cart.repository.js';

/**
 * Cart rows to the shape the storefront renders.
 *
 * The one rule it enforces is the important one: `unitPriceIdr` comes from the **variant**, not
 * from `price_at_add_idr` (CLAUDE.md non-negotiable #2). A price the customer saw an hour ago
 * is history, not an amount to charge, and the only way to guarantee that is for the mapper
 * never to read the stored column into a money field at all.
 */
export function toCartView(row: CartRow): CartView {
  const lines = row.items.map(toCartLine);

  return { id: row.id, lines, totals: totalsFor(lines) };
}

/** An actor with no cart row yet still gets a cart — an empty one, not a 404. */
export function emptyCart(): CartView {
  return { id: '', lines: [], totals: totalsFor([]) };
}

function toCartLine(row: CartLineRow): CartLine {
  const { variant } = row;
  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  const image = variant.product.images[0];

  return {
    id: row.id,
    quantity: row.quantity,
    isSelected: row.isSelected,

    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.name,
    optionValues: toOptionValues(variant.optionValues),

    productSlug: variant.product.slug,
    productName: variant.product.name,
    image:
      image === undefined
        ? null
        : { url: image.url, alt: image.alt, blurDataUrl: image.blurDataUrl },

    unitPriceIdr: variant.priceIdr,
    lineTotalIdr: lineTotal(variant.priceIdr, row.quantity),

    stockState: toStockState(available),
    availableQuantity: available,
  };
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
