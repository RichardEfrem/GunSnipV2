import type { VoucherType } from '@gunsnip/shared';
import { ValidationError } from '../../common/errors/validation.error.js';

/**
 * Which value fields a voucher of each type must and must not carry (FR-ADM-10, FR-PROMO-01).
 *
 * `evaluateVoucher` already treats a malformed voucher as INACTIVE — the customer-facing
 * behaviour, and the right one, because a customer must never see "this voucher is broken". But
 * an operator who has just created it deserves to be told *which field* is wrong, at the moment
 * they get it wrong, rather than discovering later that a live campaign silently rejects
 * everyone.
 *
 * So the same shape is checked twice on purpose, in two registers: this refuses the write, and
 * `isWellFormed` refuses to honour whatever slipped past. Pure, so the rules are testable
 * without a database, and a table so a new voucher type has to declare its shape.
 */
export interface VoucherValue {
  percentOff: number | null;
  amountIdr: number | null;
  maxDiscountIdr: number | null;
  startsAt: Date;
  endsAt: Date;
}

interface ShapeRule {
  /** The field that carries this type's value, and the sentence when it is missing. */
  requires: 'percentOff' | 'amountIdr' | null;
  requiredMessage: string;
  /** The field that means nothing for this type, and the sentence when it is set. */
  forbids: 'percentOff' | 'amountIdr' | null;
  forbiddenMessage: string;
}

const SHAPES: Readonly<Record<VoucherType, ShapeRule>> = {
  PERCENTAGE: {
    requires: 'percentOff',
    requiredMessage: 'A percentage voucher needs a percentage off, from 1 to 100.',
    forbids: 'amountIdr',
    forbiddenMessage: 'A percentage voucher takes a percentage, not a rupiah amount.',
  },
  FIXED_AMOUNT: {
    requires: 'amountIdr',
    requiredMessage: 'A fixed-amount voucher needs the rupiah amount it takes off.',
    forbids: 'percentOff',
    forbiddenMessage: 'A fixed-amount voucher takes rupiah, not a percentage.',
  },
  // Free shipping needs neither: `amountIdr` is an optional *cap* on the shipping waived, so it
  // is allowed but not required, and a percentage means nothing.
  FREE_SHIPPING: {
    requires: null,
    requiredMessage: '',
    forbids: 'percentOff',
    forbiddenMessage: 'A free-shipping voucher waives shipping; a percentage has nothing to apply to.',
  },
};

export function assertVoucherShape(type: VoucherType, value: VoucherValue): void {
  const shape = SHAPES[type];

  if (shape.requires !== null && value[shape.requires] === null) {
    throw new ValidationError(shape.requiredMessage, { type, field: shape.requires });
  }

  if (shape.forbids !== null && value[shape.forbids] !== null) {
    throw new ValidationError(shape.forbiddenMessage, { type, field: shape.forbids });
  }

  if (value.endsAt <= value.startsAt) {
    throw new ValidationError('A voucher has to end after it starts.', {
      startsAt: value.startsAt.toISOString(),
      endsAt: value.endsAt.toISOString(),
    });
  }

  // A cap below the fixed amount it caps would silently reduce every redemption, which is a
  // discount the operator did not mean to offer and cannot see in either field alone.
  if (type === 'FIXED_AMOUNT' && value.maxDiscountIdr !== null && value.amountIdr !== null) {
    if (value.maxDiscountIdr < value.amountIdr) {
      throw new ValidationError(
        'The maximum discount is below the fixed amount, so the voucher would never take off what it says.',
        { amountIdr: value.amountIdr, maxDiscountIdr: value.maxDiscountIdr },
      );
    }
  }
}
