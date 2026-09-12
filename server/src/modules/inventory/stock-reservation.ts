import { InsufficientStockError } from './errors/insufficient-stock.error.js';

/**
 * The stock rules of PRD §8.3, as pure functions over one variant's levels.
 *
 *     available = stock_on_hand − stock_reserved
 *
 * | Event                       | Effect                  |
 * |-----------------------------|-------------------------|
 * | Order created               | `stock_reserved += qty` |
 * | Order cancelled or expired  | `stock_reserved −= qty` |
 *
 * Pure, and in their own file, because stock reservation and release are a mandatory unit-test
 * target (CLAUDE.md Testing). The repository locks the variant row `FOR UPDATE`, hands its levels
 * to these functions, and writes back what they return — so the arithmetic is tested here and
 * the concurrency is the database's, and neither has to be trusted to do the other's job.
 */
export interface StockLevel {
  variantId: string;
  /** For the error message — FR-CO-08 names the line. */
  productName: string;
  stockOnHand: number;
  stockReserved: number;
}

/** Never negative: a variant reserved past its stock (an operator write-down) has none, not −2. */
export function availableStock(level: Pick<StockLevel, 'stockOnHand' | 'stockReserved'>): number {
  return Math.max(0, level.stockOnHand - level.stockReserved);
}

/** Holds `quantity` against a placed order, or refuses naming the line (FR-CO-08). */
export function reserveStock(level: StockLevel, quantity: number): StockLevel {
  assertPositive(quantity);

  const available = availableStock(level);
  if (quantity > available) {
    throw new InsufficientStockError(level.productName, level.variantId, quantity, available);
  }

  return { ...level, stockReserved: level.stockReserved + quantity };
}

/**
 * Gives back what a cancelled or expired order held.
 *
 * Releasing more than is reserved is a bug, not a customer error — it would mean an order held
 * stock that was never recorded against it — so it throws a plain `Error` (a 500) rather than
 * quietly flooring at zero and hiding the corruption.
 */
export function releaseStock(level: StockLevel, quantity: number): StockLevel {
  assertPositive(quantity);

  if (quantity > level.stockReserved) {
    throw new Error(
      `Cannot release ${quantity} of variant ${level.variantId}: only ${level.stockReserved} reserved.`,
    );
  }

  return { ...level, stockReserved: level.stockReserved - quantity };
}

function assertPositive(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Stock quantities are positive integers, received ${quantity}.`);
  }
}
