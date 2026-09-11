import type { CartLine, CartTotals } from './entities/cart.entity.js';

/**
 * What a cart costs (FR-CART-03).
 *
 * A pure function over lines the repository has already priced from the database, kept in its
 * own file because CLAUDE.md makes price calculation a mandatory unit-test target and because
 * a total that lives inside a service method is a total nobody tests directly.
 *
 * Integer arithmetic throughout — IDR is stored in whole rupiah (PRD A2) and every input here
 * is already an integer, so the sum is exact with no rounding step to get wrong.
 */
export function totalsFor(lines: readonly CartLine[]): CartTotals {
  const selected = lines.filter((line) => line.isSelected);

  return {
    // Deselecting a line drops it from the total (DoD §13.4) — that is this filter, and it is
    // the reason the total is computed rather than stored.
    subtotalIdr: selected.reduce((total, line) => total + line.lineTotalIdr, 0),
    lineCount: lines.length,
    selectedQuantity: selected.reduce((total, line) => total + line.quantity, 0),
  };
}

/**
 * A line's total. One place, so the figure beside a line and the figure it contributes to the
 * subtotal cannot be computed two different ways.
 */
export function lineTotal(unitPriceIdr: number, quantity: number): number {
  return unitPriceIdr * quantity;
}
