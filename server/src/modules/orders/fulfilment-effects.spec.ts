import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES } from '@gunsnip/shared';
import { FULFILMENT_EFFECTS } from './fulfilment-effects.js';
import { ORDER_TRANSITIONS } from './order-status-machine.js';

/**
 * The fulfilment side-effect table (FR-ADM-08). Tested alongside the state machine it sits
 * beside, because the two together are what decide whether stock and money end up correct.
 */
describe('FULFILMENT_EFFECTS', () => {
  it('covers every order status, so a new one cannot silently do nothing', () => {
    expect(Object.keys(FULFILMENT_EFFECTS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('consumes stock exactly once across the whole lifecycle', () => {
    const consuming = ORDER_STATUSES.filter((status) => FULFILMENT_EFFECTS[status].stock === 'consume');

    expect(consuming).toEqual(['SHIPPED']);
  });

  it('releases stock for exactly the two statuses that mean the order did not happen', () => {
    const releasing = ORDER_STATUSES.filter((status) => FULFILMENT_EFFECTS[status].stock === 'release');

    expect(releasing.sort()).toEqual(['CANCELLED', 'EXPIRED']);
  });

  it('only consumes stock on a status the machine can actually reach', () => {
    const reachable = new Set(Object.values(ORDER_TRANSITIONS).flat());

    for (const status of ORDER_STATUSES) {
      if (FULFILMENT_EFFECTS[status].stock !== 'hold') expect(reachable.has(status)).toBe(true);
    }
  });

  it('requires a shipment only where stock is dispatched', () => {
    for (const status of ORDER_STATUSES) {
      const effect = FULFILMENT_EFFECTS[status];
      if (effect.requiresShipment === true) expect(effect.stock).toBe('consume');
    }
  });

  it('never both releases and consumes — the type makes it one or the other', () => {
    for (const status of ORDER_STATUSES) {
      expect(['hold', 'release', 'consume']).toContain(FULFILMENT_EFFECTS[status].stock);
    }
  });

  it('gives every status a default note, so an event row is never left unexplained', () => {
    for (const status of ORDER_STATUSES) {
      expect(FULFILMENT_EFFECTS[status].note.length).toBeGreaterThan(0);
    }
  });
});
