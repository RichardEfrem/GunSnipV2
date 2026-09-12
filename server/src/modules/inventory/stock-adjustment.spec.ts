import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../common/errors/validation.error.js';
import { adjustStock } from './stock-adjustment.js';
import { availableStock, type StockLevel } from './stock-reservation.js';

/**
 * Operator stock adjustment (FR-ADM-05). Part of the mandatory stock coverage (CLAUDE.md
 * Testing): this is the other half of how inventory changes, and the half an operator drives
 * by hand.
 */
function level(overrides: Partial<StockLevel> = {}): StockLevel {
  return {
    variantId: 'variant-1',
    productName: 'MG Gundam Exia',
    stockOnHand: 10,
    stockReserved: 0,
    ...overrides,
  };
}

describe('adjustStock', () => {
  it('adds a restock to stock on hand', () => {
    expect(adjustStock(level({ stockOnHand: 10 }), 5).stockOnHand).toBe(15);
  });

  it('subtracts a write-down from stock on hand', () => {
    expect(adjustStock(level({ stockOnHand: 10 }), -4).stockOnHand).toBe(6);
  });

  it('leaves reservations alone — adjustment and reservation are separate counters', () => {
    const adjusted = adjustStock(level({ stockOnHand: 10, stockReserved: 3 }), 5);

    expect(adjusted.stockReserved).toBe(3);
    expect(availableStock(adjusted)).toBe(12);
  });

  it('refuses to take stock below zero, naming what is there', () => {
    const attempt = () => adjustStock(level({ stockOnHand: 4 }), -5);

    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow('MG Gundam Exia has 4 on hand');
  });

  it('refuses to write off units reserved for placed orders, naming what is free', () => {
    const attempt = () => adjustStock(level({ stockOnHand: 10, stockReserved: 7 }), -5);

    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow('7 of MG Gundam Exia are reserved for placed orders, leaving 3 free');
  });

  it('allows removing exactly what is free', () => {
    expect(adjustStock(level({ stockOnHand: 10, stockReserved: 7 }), -3).stockOnHand).toBe(7);
  });

  it.each([0, 1.5, Number.NaN])('rejects a delta of %s', (delta) => {
    expect(() => adjustStock(level(), delta)).toThrow('non-zero whole number');
  });
});
