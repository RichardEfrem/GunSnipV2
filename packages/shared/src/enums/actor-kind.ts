/**
 * Who caused an audited change — written to `order_event` and `inventory_movement`
 * (FR-ORD-06, FR-ADM-05).
 *
 * Deliberately wider than the `Actor` union: an audit row can also be attributed to `SYSTEM`,
 * which is what the payment-expiry job writes (FR-PAY-06). `Actor` describes who is making a
 * request; this describes who is responsible for a row, and a scheduled job makes no request.
 */
export const ACTOR_KINDS = ['GUEST', 'USER', 'ADMIN', 'SYSTEM'] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];
