import { ORDER_NUMBER_PATTERN } from '@gunsnip/shared';
import { describe, expect, it } from 'vitest';
import { formatOrderNumber, randomOrderNumber } from './order-number.js';

describe('order numbers (FR-ORD-01)', () => {
  it('formats GS-YYMMDD-XXXX with a zero-padded suffix', () => {
    expect(formatOrderNumber(new Date('2026-09-07T05:00:00Z'), 4471)).toBe('GS-260907-4471');
    expect(formatOrderNumber(new Date('2026-09-07T05:00:00Z'), 7)).toBe('GS-260907-0007');
  });

  it('dates the order in Jakarta, not UTC', () => {
    // 23:30 UTC on the 6th is 06:30 WIB on the 7th.
    expect(formatOrderNumber(new Date('2026-09-06T23:30:00Z'), 1)).toBe('GS-260907-0001');
  });

  it('rolls the year over at Jakarta midnight', () => {
    expect(formatOrderNumber(new Date('2026-12-31T17:00:00Z'), 1)).toBe('GS-270101-0001');
  });

  it.each([-1, 10_000, 1.5])('rejects a suffix of %s', (suffix) => {
    expect(() => formatOrderNumber(new Date(), suffix)).toThrow(RangeError);
  });

  it('always produces a number the shared pattern accepts', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(randomOrderNumber(new Date())).toMatch(ORDER_NUMBER_PATTERN);
    }
  });
});
