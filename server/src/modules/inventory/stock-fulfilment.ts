import type { StockLevel } from './stock-reservation.js';

/**
 * What happens to stock when an order actually ships (PRD §8.3, reason `ORDER_FULFILLED`).
 *
 * Placing an order only *reserves*: `stock_reserved` goes up and `stock_on_hand` is untouched,
 * because the units are still on the shelf. Dispatch is when they leave, and both counters drop
 * together — so `available = stock_on_hand − stock_reserved` is unchanged by this step, which is
 * right: those units stopped being available the moment they were reserved.
 *
 * Without this the two counters grow forever. Availability would still read correctly, but
 * `stock_on_hand` would claim a warehouse full of goods that shipped months ago, and the
 * low-stock dashboard (FR-ADM-01) would be counting them.
 *
 * Consuming more than is reserved is corruption, not a customer error — it would mean shipping
 * units no order ever held — so it throws a plain `Error` (a 500) rather than clamping.
 */
export function consumeStock(level: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Stock quantities are positive integers, received ${quantity}.`);
  }

  if (quantity > level.stockReserved) {
    throw new Error(
      `Cannot fulfil ${quantity} of variant ${level.variantId}: only ${level.stockReserved} reserved.`,
    );
  }

  if (quantity > level.stockOnHand) {
    throw new Error(
      `Cannot fulfil ${quantity} of variant ${level.variantId}: only ${level.stockOnHand} on hand.`,
    );
  }

  return {
    ...level,
    stockOnHand: level.stockOnHand - quantity,
    stockReserved: level.stockReserved - quantity,
  };
}
