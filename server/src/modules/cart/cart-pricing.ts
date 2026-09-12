import type { CartLine, CartTotals } from './entities/cart.entity.js';

/**
 * What a cart costs (FR-CART-03, FR-CART-05).
 *
 * Pure functions over lines the repository has already priced from the database, kept in their
 * own file because CLAUDE.md makes price calculation a mandatory unit-test target and because a
 * total that lives inside a service method is a total nobody tests directly.
 *
 * Integer arithmetic throughout — IDR is stored in whole rupiah (PRD A2) and every input here
 * is already an integer, so the sums are exact with no rounding step to get wrong.
 */

/** What the cart adds and takes off beyond its lines, both already decided by the service. */
export interface CartCharges {
  shippingIdr: number;
  discountIdr: number;
}

const NO_CHARGES: CartCharges = { shippingIdr: 0, discountIdr: 0 };

/**
 * The lines that count towards a total: selected by the customer (FR-CART-03) and purchasable
 * right now (FR-CART-04). Deselecting a line drops it from the total (DoD §13.4) — that is this
 * filter, and it is the reason the total is computed rather than stored.
 */
export function countedLines(lines: readonly CartLine[]): readonly CartLine[] {
  return lines.filter((line) => line.isSelected && line.isPurchasable);
}

export function totalsFor(lines: readonly CartLine[], charges: CartCharges = NO_CHARGES): CartTotals {
  const counted = countedLines(lines);
  const subtotalIdr = counted.reduce((total, line) => total + line.lineTotalIdr, 0);

  // Nothing to ship means no shipping, whatever estimate the caller passed.
  const shippingIdr = counted.length === 0 ? 0 : charges.shippingIdr;
  // A discount can never take the total below zero. The voucher rules already bound it by the
  // thing it discounts; this is the last line of defence, not the rule.
  const discountIdr = Math.min(charges.discountIdr, subtotalIdr + shippingIdr);

  return {
    subtotalIdr,
    discountIdr,
    shippingIdr,
    totalIdr: subtotalIdr - discountIdr + shippingIdr,
    lineCount: lines.length,
    selectedQuantity: counted.reduce((total, line) => total + line.quantity, 0),
  };
}

/**
 * A line's total. One place, so the figure beside a line and the figure it contributes to the
 * subtotal cannot be computed two different ways.
 */
export function lineTotal(unitPriceIdr: number, quantity: number): number {
  return unitPriceIdr * quantity;
}
