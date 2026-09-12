import { describe, expect, it } from 'vitest';
import { consumeStock } from './stock-fulfilment.js';
import { availableStock, reserveStock, type StockLevel } from './stock-reservation.js';

/**
 * Stock leaving the building — the third of the three ways stock moves, and a mandatory
 * unit-test target alongside reservation and release (CLAUDE.md Testing).
 */
function level(overrides: Partial<StockLevel> = {}): StockLevel {
  return { variantId: 'variant-1', productName: 'MG Gundam Exia', stockOnHand: 10, stockReserved: 3, ...overrides };
}

describe('consumeStock', () => {
  it('drops both counters, because the units have physically left', () => {
    const consumed = consumeStock(level({ stockOnHand: 10, stockReserved: 3 }), 3);

    expect(consumed.stockOnHand).toBe(7);
    expect(consumed.stockReserved).toBe(0);
  });

  it('leaves availability unchanged — those units stopped being available when they were reserved', () => {
    const reserved = reserveStock(level({ stockOnHand: 10, stockReserved: 0 }), 4);

    expect(availableStock(consumeStock(reserved, 4))).toBe(availableStock(reserved));
  });

  it('consumes only its own quantity when other orders still hold stock', () => {
    const consumed = consumeStock(level({ stockOnHand: 10, stockReserved: 5 }), 2);

    expect(consumed.stockOnHand).toBe(8);
    expect(consumed.stockReserved).toBe(3);
  });

  it('refuses to ship more than was reserved, rather than inventing a reservation', () => {
    expect(() => consumeStock(level({ stockOnHand: 10, stockReserved: 1 }), 2)).toThrow('only 1 reserved');
  });

  it('refuses to ship more than is on hand, even when the reservation says otherwise', () => {
    expect(() => consumeStock(level({ stockOnHand: 1, stockReserved: 5 }), 2)).toThrow('only 1 on hand');
  });

  it.each([0, -1, 2.5])('rejects a quantity of %s', (quantity) => {
    expect(() => consumeStock(level(), quantity)).toThrow('positive integers');
  });
});
