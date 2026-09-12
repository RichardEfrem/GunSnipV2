import type { Actor } from '@gunsnip/shared';
import { describe, expect, it } from 'vitest';
import { canAccessOrder } from './order-access.js';

const ORDER = { sessionId: 'session-a', userId: null, email: 'amuro@example.com' };
const guest = (sessionId: string): Actor => ({ kind: 'guest', sessionId });

describe('canAccessOrder (FR-ORD-02)', () => {
  it('lets the placing session see its order without an email', () => {
    expect(canAccessOrder(ORDER, guest('session-a'), undefined)).toBe(true);
  });

  it('lets another device in with the order email', () => {
    expect(canAccessOrder(ORDER, guest('session-b'), 'amuro@example.com')).toBe(true);
  });

  it('refuses another device with the wrong email or none', () => {
    expect(canAccessOrder(ORDER, guest('session-b'), 'char@example.com')).toBe(false);
    expect(canAccessOrder(ORDER, guest('session-b'), undefined)).toBe(false);
  });

  it('lets a signed-in user see an order bound to their account from any session', () => {
    const user: Actor = { kind: 'user', sessionId: 'session-c', userId: 'user-1', roles: ['CUSTOMER'] };
    expect(canAccessOrder({ ...ORDER, userId: 'user-1' }, user, undefined)).toBe(true);
  });
});
