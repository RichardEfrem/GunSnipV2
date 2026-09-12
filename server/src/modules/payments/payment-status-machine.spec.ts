import { PAYMENT_STATUSES, type PaymentStatus } from '@gunsnip/shared';
import { describe, expect, it } from 'vitest';
import { IllegalTransitionError } from '../../common/errors/illegal-transition.error.js';
import { PAYMENT_TRANSITIONS, assertPaymentTransition, canTransitionPayment } from './payment-status-machine.js';

/**
 * The payment state machine — a mandatory unit-test target (CLAUDE.md Testing). Every legal edge
 * of PRD §8.2 is asserted, and then every other pair is asserted illegal, so an edge added to the
 * map by accident fails here as surely as one removed.
 */
const LEGAL: readonly (readonly [PaymentStatus, PaymentStatus])[] = [
  ['PENDING', 'PAID'],
  ['PENDING', 'FAILED'],
  ['PENDING', 'EXPIRED'],
  ['PAID', 'REFUNDED'],
];

const isLegal = (from: PaymentStatus, to: PaymentStatus) => LEGAL.some(([a, b]) => a === from && b === to);

const ILLEGAL = PAYMENT_STATUSES.flatMap((from) =>
  PAYMENT_STATUSES.filter((to) => !isLegal(from, to)).map((to) => [from, to] as const),
);

describe('payment state machine', () => {
  it.each(LEGAL)('allows %s → %s', (from, to) => {
    expect(canTransitionPayment(from, to)).toBe(true);
    expect(assertPaymentTransition(from, to)).toBe(to);
  });

  it.each(ILLEGAL)('refuses %s → %s', (from, to) => {
    expect(canTransitionPayment(from, to)).toBe(false);
    expect(() => assertPaymentTransition(from, to)).toThrow(IllegalTransitionError);
  });

  it('holds exactly the edges of PRD §8.2 and no others', () => {
    const edges = Object.entries(PAYMENT_TRANSITIONS).flatMap(([from, targets]) =>
      targets.map((to) => `${from}→${to}`),
    );

    expect(edges.sort()).toEqual(LEGAL.map(([from, to]) => `${from}→${to}`).sort());
  });

  it('only ever settles a charge that is still open', () => {
    const payableFrom = PAYMENT_STATUSES.filter((status) => canTransitionPayment(status, 'PAID'));
    expect(payableFrom).toEqual(['PENDING']);
  });

  it('never reopens a closed charge', () => {
    const reopenable = PAYMENT_STATUSES.filter((status) => canTransitionPayment(status, 'PENDING'));
    expect(reopenable).toEqual([]);
  });

  it('treats failed, expired and refunded as terminal', () => {
    for (const status of ['FAILED', 'EXPIRED', 'REFUNDED'] as const) {
      expect(PAYMENT_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('explains a late payment in words a customer can read', () => {
    expect(() => assertPaymentTransition('PAID', 'PAID')).toThrow('already been paid');
    expect(() => assertPaymentTransition('EXPIRED', 'PAID')).toThrow('closed and can no longer be paid');
    expect(() => assertPaymentTransition('FAILED', 'PAID')).toThrow('closed and can no longer be paid');
  });
});
