import { describe, expect, it } from 'vitest';
import { VOUCHER_TYPES } from '@gunsnip/shared';
import { ValidationError } from '../../common/errors/validation.error.js';
import { assertVoucherShape, type VoucherValue } from './voucher-shape.js';

/**
 * Voucher validation is a mandatory unit-test target (CLAUDE.md Testing). `voucher-rules.spec`
 * covers whether a voucher *applies*; this covers whether it is one at all.
 */
function value(overrides: Partial<VoucherValue> = {}): VoucherValue {
  return {
    percentOff: null,
    amountIdr: null,
    maxDiscountIdr: null,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-02-01T00:00:00Z'),
    ...overrides,
  };
}

describe('assertVoucherShape', () => {
  it('accepts a percentage voucher with a percentage', () => {
    expect(() => assertVoucherShape('PERCENTAGE', value({ percentOff: 15 }))).not.toThrow();
  });

  it('refuses a percentage voucher with no percentage, naming the field', () => {
    const attempt = () => assertVoucherShape('PERCENTAGE', value());

    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow('needs a percentage off');
  });

  it('refuses a percentage voucher carrying rupiah as well', () => {
    expect(() => assertVoucherShape('PERCENTAGE', value({ percentOff: 15, amountIdr: 50_000 }))).toThrow(
      'not a rupiah amount',
    );
  });

  it('accepts a fixed-amount voucher with an amount', () => {
    expect(() => assertVoucherShape('FIXED_AMOUNT', value({ amountIdr: 50_000 }))).not.toThrow();
  });

  it('refuses a fixed-amount voucher with no amount', () => {
    expect(() => assertVoucherShape('FIXED_AMOUNT', value())).toThrow('needs the rupiah amount');
  });

  it('accepts free shipping with neither value — there is nothing to state', () => {
    expect(() => assertVoucherShape('FREE_SHIPPING', value())).not.toThrow();
  });

  it('accepts free shipping with a cap on the shipping waived', () => {
    expect(() => assertVoucherShape('FREE_SHIPPING', value({ amountIdr: 30_000 }))).not.toThrow();
  });

  it('refuses free shipping with a percentage, which has nothing to apply to', () => {
    expect(() => assertVoucherShape('FREE_SHIPPING', value({ percentOff: 10 }))).toThrow('nothing to apply to');
  });

  it('refuses a window that ends before it starts', () => {
    expect(() =>
      assertVoucherShape(
        'FIXED_AMOUNT',
        value({ amountIdr: 50_000, startsAt: new Date('2026-03-01Z'), endsAt: new Date('2026-02-01Z') }),
      ),
    ).toThrow('has to end after it starts');
  });

  it('refuses a window of zero length', () => {
    const at = new Date('2026-01-01T00:00:00Z');

    expect(() => assertVoucherShape('FIXED_AMOUNT', value({ amountIdr: 50_000, startsAt: at, endsAt: at }))).toThrow(
      'has to end after it starts',
    );
  });

  it('refuses a cap below the fixed amount it caps', () => {
    expect(() =>
      assertVoucherShape('FIXED_AMOUNT', value({ amountIdr: 50_000, maxDiscountIdr: 20_000 })),
    ).toThrow('would never take off what it says');
  });

  it('has a shape rule for every voucher type', () => {
    for (const type of VOUCHER_TYPES) {
      // Each type either accepts the empty value or names the field it is missing — never
      // throws something unrelated, which is what an unlisted type would do.
      try {
        assertVoucherShape(type, value());
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
      }
    }
  });
});
