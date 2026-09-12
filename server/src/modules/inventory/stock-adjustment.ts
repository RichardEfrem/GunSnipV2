import { ValidationError } from '../../common/errors/validation.error.js';
import type { StockLevel } from './stock-reservation.js';

/**
 * Operator stock adjustment (FR-ADM-05), as a pure function over one variant's levels.
 *
 * Adjustment moves `stock_on_hand`; reservation moves `stock_reserved` (`stock-reservation.ts`).
 * Keeping them apart is the point — a restock must never quietly satisfy a reservation that
 * failed, and a release must never look like stock arriving. Each has its own arithmetic and its
 * own audit row.
 *
 * A negative delta may not cut into stock that is already reserved for placed orders: those
 * units are promised, and writing them off here would let the same unit ship twice. The operator
 * is told how much is actually free to remove rather than being silently clamped.
 */
export function adjustStock(level: StockLevel, delta: number): StockLevel {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new ValidationError('A stock adjustment has to be a non-zero whole number.', { delta });
  }

  const stockOnHand = level.stockOnHand + delta;

  if (stockOnHand < 0) {
    throw new ValidationError(
      `Cannot remove ${Math.abs(delta)} — ${level.productName} has ${level.stockOnHand} on hand.`,
      { requested: Math.abs(delta), stockOnHand: level.stockOnHand },
    );
  }

  if (stockOnHand < level.stockReserved) {
    throw new ValidationError(
      `Cannot remove ${Math.abs(delta)} — ${level.stockReserved} of ${level.productName} ` +
        `are reserved for placed orders, leaving ${level.stockOnHand - level.stockReserved} free to adjust.`,
      { requested: Math.abs(delta), free: level.stockOnHand - level.stockReserved, stockReserved: level.stockReserved },
    );
  }

  return { ...level, stockOnHand };
}
