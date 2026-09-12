import { describe, expect, it } from 'vitest';
import { InsufficientStockError } from './errors/insufficient-stock.error.js';
import { availableStock, releaseStock, reserveStock, type StockLevel } from './stock-reservation.js';

/**
 * Stock reservation and release — a mandatory unit-test target (CLAUDE.md Testing), because
 * this is where inventory breaks. The concurrency half (`FOR UPDATE`) is covered by the checkout
 * integration suite against a real database; this covers the arithmetic.
 */
function level(overrides: Partial<StockLevel> = {}): StockLevel {
  return { variantId: 'variant-1', productName: 'MG Gundam Exia', stockOnHand: 8, stockReserved: 0, ...overrides };
}

describe('availableStock', () => {
  it('is on hand minus reserved (PRD §8.3)', () => {
    expect(availableStock(level({ stockOnHand: 8, stockReserved: 3 }))).toBe(5);
  });

  it('never goes negative when more is reserved than is on hand', () => {
    expect(availableStock(level({ stockOnHand: 2, stockReserved: 5 }))).toBe(0);
  });
});

describe('reserveStock', () => {
  it('adds the quantity to the reserved count and leaves stock on hand alone', () => {
    const reserved = reserveStock(level({ stockOnHand: 8, stockReserved: 3 }), 2);

    expect(reserved.stockReserved).toBe(5);
    expect(reserved.stockOnHand).toBe(8);
    expect(availableStock(reserved)).toBe(3);
  });

  it('can reserve exactly what is left', () => {
    expect(availableStock(reserveStock(level({ stockOnHand: 4, stockReserved: 1 }), 3))).toBe(0);
  });

  it('refuses more than is available, naming the line (FR-CO-08)', () => {
    const attempt = () => reserveStock(level({ stockOnHand: 4, stockReserved: 2 }), 3);

    expect(attempt).toThrow(InsufficientStockError);
    expect(attempt).toThrow('Only 2 of MG Gundam Exia left.');
  });

  it('says out of stock rather than "only 0 left"', () => {
    expect(() => reserveStock(level({ stockOnHand: 3, stockReserved: 3 }), 1)).toThrow(
      'MG Gundam Exia is out of stock.',
    );
  });

  it('carries the numbers in the error details', () => {
    try {
      reserveStock(level({ stockOnHand: 4, stockReserved: 2 }), 3);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientStockError);
      expect((error as InsufficientStockError).details).toMatchObject({ requested: 3, available: 2 });
    }
  });

  it.each([0, -1, 1.5])('rejects a quantity of %s', (quantity) => {
    expect(() => reserveStock(level(), quantity)).toThrow('positive integers');
  });
});

describe('releaseStock', () => {
  it('returns what an order held, restoring availability (DoD §13.6)', () => {
    const before = level({ stockOnHand: 8, stockReserved: 0 });
    const released = releaseStock(reserveStock(before, 3), 3);

    expect(released.stockReserved).toBe(0);
    expect(availableStock(released)).toBe(availableStock(before));
  });

  it('releases only its own quantity when other orders hold stock too', () => {
    expect(releaseStock(level({ stockReserved: 5 }), 2).stockReserved).toBe(3);
  });

  it('treats releasing more than is reserved as corruption, not a floor at zero', () => {
    expect(() => releaseStock(level({ stockReserved: 1 }), 2)).toThrow('only 1 reserved');
  });
});
