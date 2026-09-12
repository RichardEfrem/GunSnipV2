import { ConflictError } from '../../common/errors/conflict.error.js';
import { lineTotal } from '../cart/cart-pricing.js';
import { revalidateLine } from '../cart/cart-revalidation.js';
import type { CartNotice } from '../cart/entities/cart.entity.js';
import { availableStock } from '../inventory/stock-reservation.js';
import type { Basket, BasketLine } from './entities/basket.entity.js';
import { CartChangedError } from './errors/cart-changed.error.js';

/**
 * Which cart lines become order lines, and at what quantity.
 *
 * Two questions, asked at two moments, answered by one file so they cannot drift:
 *
 * - **Quoting** (`POST /checkout/quote`): what the summary shows. The selected lines that can be
 *   bought, each at what can be honoured of it — the same revalidation the cart page runs
 *   (FR-CART-04), so checkout and cart never disagree about a line.
 * - **Placing** (`POST /orders`): what the customer confirmed. The client sends back the lines
 *   the quote showed; each has to still be a selected line of this cart, at no more than the cart
 *   holds. Stock is then reserved against them (`reserveStock`), which is where a line that has
 *   since run short is refused by name (FR-CO-08).
 *
 * Neither reads a price from anywhere but the variant.
 */
export interface OrderLine {
  basketLine: BasketLine;
  quantity: number;
  /** `unitPriceIdr × quantity`, from the variant (CLAUDE.md non-negotiable #2). */
  lineTotalIdr: number;
}

export interface QuotedLine extends OrderLine {
  /** What changed since the line was added — shown, never applied silently (FR-CART-04). */
  notices: readonly CartNotice[];
}

export interface QuotedLines {
  lines: readonly QuotedLine[];
  /** Selected lines that cannot be bought right now, and so are not in the quote. */
  unavailableCount: number;
}

/**
 * A line as the client confirms it: **which cart line**, how many. Never a price.
 *
 * The cart line, not the variant. A variant can legitimately be in the cart twice once bundles
 * exist (FR-CAT-11) — a loose nipper and the nipper inside a starter bundle are two lines at two
 * different prices — so a variant id no longer identifies one line, and matching on it would
 * order the wrong one at the wrong price.
 */
export interface RequestedLine {
  cartLineId: string;
  quantity: number;
}

export function quotableLines(basket: Basket | null): QuotedLines {
  if (basket === null) return { lines: [], unavailableCount: 0 };

  const lines: QuotedLine[] = [];
  let unavailableCount = 0;

  for (const line of basket.lines) {
    const { quantity, isPurchasable, notices } = revalidateLine({
      requestedQuantity: line.requestedQuantity,
      unitPriceIdr: line.unitPriceIdr,
      priceAtAddIdr: line.priceAtAddIdr,
      availableQuantity: availableStock(line),
      isSellable: line.isSellable,
    });

    if (!isPurchasable) {
      unavailableCount += 1;
      continue;
    }

    lines.push({ basketLine: line, quantity, lineTotalIdr: lineTotal(line.unitPriceIdr, quantity), notices });
  }

  return { lines, unavailableCount };
}

/**
 * The lines to place, or the reason the cart no longer matches what the customer confirmed.
 *
 * Asking for *less* than the cart holds is allowed — that is exactly what a line reads as when
 * stock ran short and the quote showed the reduced quantity. Asking for more, or for a line that
 * is gone or deselected, means the cart changed in another tab.
 */
export function orderableLines(basket: Basket, requested: readonly RequestedLine[]): OrderLine[] {
  return requested.map((request) => {
    const line = basket.lines.find((candidate) => candidate.cartLineId === request.cartLineId);

    if (line === undefined || request.quantity > line.requestedQuantity) {
      throw new CartChangedError({ cartLineId: request.cartLineId });
    }

    if (!line.isSellable) {
      throw new ConflictError(`${line.productName} is no longer available.`, { variantId: line.variantId });
    }

    return { basketLine: line, quantity: request.quantity, lineTotalIdr: lineTotal(line.unitPriceIdr, request.quantity) };
  });
}
