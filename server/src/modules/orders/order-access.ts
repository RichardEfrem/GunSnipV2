import { isUserActor, type Actor } from '@gunsnip/shared';

/**
 * Who may see or cancel an order (FR-ORD-02, FR-ORD-04).
 *
 * - **The session that placed it** — the confirmation page right after checkout, and any later
 *   visit from the same browser. A Phase 1 user also matches on their user id, so a guest who
 *   signs in keeps sight of what they ordered.
 * - **Anyone holding the order number and the email it was placed with** — guest lookup from
 *   another device, no account needed (FR-ORD-02).
 *
 * Everyone else gets the same answer as for an order that does not exist, so the endpoint does
 * not confirm which order numbers are real.
 */
export interface OrderOwnership {
  sessionId: string;
  userId: string | null;
  /** As stored in the snapshot — lower-cased at the boundary. */
  email: string;
}

export function canAccessOrder(order: OrderOwnership, actor: Actor, email: string | undefined): boolean {
  if (order.sessionId === actor.sessionId) return true;
  if (isUserActor(actor) && order.userId === actor.userId) return true;

  return email !== undefined && email === order.email;
}
