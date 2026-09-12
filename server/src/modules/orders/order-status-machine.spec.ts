import { ORDER_STATUSES, type OrderStatus } from '@gunsnip/shared';
import { describe, expect, it } from 'vitest';
import { IllegalTransitionError } from '../../common/errors/illegal-transition.error.js';
import { ORDER_TRANSITIONS, assertOrderTransition, canTransitionOrder } from './order-status-machine.js';

/**
 * The order state machine — a mandatory unit-test target (CLAUDE.md Testing). Every legal edge
 * of PRD §8.1 is asserted, and then every other pair is asserted illegal, so an edge added to the
 * map by accident fails here as surely as one removed.
 */
const LEGAL: readonly (readonly [OrderStatus, OrderStatus])[] = [
  ['PENDING_PAYMENT', 'PAID'],
  ['PENDING_PAYMENT', 'CANCELLED'],
  ['PENDING_PAYMENT', 'EXPIRED'],
  ['PAID', 'PACKING'],
  ['PACKING', 'SHIPPED'],
  ['SHIPPED', 'DELIVERED'],
  ['DELIVERED', 'COMPLETED'],
  ['DELIVERED', 'REFUNDED'],
];

const isLegal = (from: OrderStatus, to: OrderStatus) => LEGAL.some(([a, b]) => a === from && b === to);

const ILLEGAL = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.filter((to) => !isLegal(from, to)).map((to) => [from, to] as const),
);

describe('order state machine', () => {
  it.each(LEGAL)('allows %s → %s', (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(true);
    expect(assertOrderTransition(from, to)).toBe(to);
  });

  it.each(ILLEGAL)('refuses %s → %s', (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(false);
    expect(() => assertOrderTransition(from, to)).toThrow(IllegalTransitionError);
  });

  it('holds exactly the edges of PRD §8.1 and no others', () => {
    const edges = Object.entries(ORDER_TRANSITIONS).flatMap(([from, targets]) =>
      targets.map((to) => `${from}→${to}`),
    );

    expect(edges.sort()).toEqual(LEGAL.map(([from, to]) => `${from}→${to}`).sort());
  });

  it('lets a buyer cancel only while awaiting payment (FR-ORD-04)', () => {
    const cancellableFrom = ORDER_STATUSES.filter((status) => canTransitionOrder(status, 'CANCELLED'));
    expect(cancellableFrom).toEqual(['PENDING_PAYMENT']);
  });

  it('explains a late cancel in words a customer can read', () => {
    expect(() => assertOrderTransition('SHIPPED', 'CANCELLED')).toThrow('can no longer be cancelled');
    expect(() => assertOrderTransition('CANCELLED', 'CANCELLED')).toThrow('already cancelled');
  });

  it('treats completed, cancelled, expired and refunded as terminal', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED'] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
    }
  });
});

describe('the default refusal message', () => {
  it('reads as a sentence, not as a bug in the shop', () => {
    // "A order cannot move…" is what an operator sees when they try an illegal transition, so
    // the article is part of the behaviour rather than a detail of the template.
    expect(() => assertOrderTransition('PAID', 'SHIPPED')).toThrow('An order cannot move from PAID to SHIPPED.');
  });
});
