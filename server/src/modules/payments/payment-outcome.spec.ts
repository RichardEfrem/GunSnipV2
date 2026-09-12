import { PAYMENT_STATUSES } from '@gunsnip/shared';
import { describe, expect, it } from 'vitest';
import { canTransitionOrder } from '../orders/order-status-machine.js';
import { orderOutcomeOf } from './payment-outcome.js';

/**
 * The join between the machines (PRD §8.1, §8.2, §8.3). Worth its own spec because it is the one
 * table that can be wrong without either machine being wrong — an outcome naming an order status
 * its own machine will not accept, or an order given back stock it no longer holds.
 */
describe('orderOutcomeOf', () => {
  it('moves the order to PAID and keeps its stock reserved', () => {
    expect(orderOutcomeOf('PAID')).toMatchObject({ orderStatus: 'PAID', isAbandoned: false });
  });

  it('cancels the order on a failed payment and gives back what it held', () => {
    expect(orderOutcomeOf('FAILED')).toMatchObject({ orderStatus: 'CANCELLED', isAbandoned: true });
  });

  it('expires the order when the window closes and gives back what it held (DoD §13.8)', () => {
    expect(orderOutcomeOf('EXPIRED')).toMatchObject({ orderStatus: 'EXPIRED', isAbandoned: true });
  });

  it('leaves stock alone on a refund — those units shipped', () => {
    expect(orderOutcomeOf('REFUNDED')).toMatchObject({ orderStatus: 'REFUNDED', isAbandoned: false });
  });

  it('says nothing about the order when the charge merely opens', () => {
    expect(orderOutcomeOf('PENDING')).toBeNull();
  });

  it('only ever names an order status a PENDING_PAYMENT order can actually reach', () => {
    // Every outcome here follows a payment leaving PENDING, and an order whose payment is still
    // pending is PENDING_PAYMENT — except a refund, which follows a delivered order.
    const fromPending = PAYMENT_STATUSES.filter((status) => status !== 'PENDING' && status !== 'REFUNDED');

    for (const status of fromPending) {
      const outcome = orderOutcomeOf(status);
      expect(outcome).not.toBeNull();
      expect(canTransitionOrder('PENDING_PAYMENT', outcome?.orderStatus ?? 'PENDING_PAYMENT')).toBe(true);
    }

    expect(canTransitionOrder('DELIVERED', 'REFUNDED')).toBe(true);
  });

  it('gives every abandoning outcome a reason the customer can read', () => {
    for (const status of PAYMENT_STATUSES) {
      const outcome = orderOutcomeOf(status);
      if (outcome?.isAbandoned === true) expect(outcome.cancelReason).toBeTruthy();
    }
  });
});
