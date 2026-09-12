import { isUserActor, type Actor, type ActorKind } from '@gunsnip/shared';

/**
 * Who an audit row is attributed to (FR-ORD-06): the actor's kind and id, in the columns
 * `order_event` and `inventory_movement` share.
 *
 * A guest is recorded by session, a user by user id. `SYSTEM` and `ADMIN` rows are the constants
 * below — neither is an `Actor`, because neither makes a storefront request. Phase 1 gives the
 * admin an identity and `ADMIN_AUDIT` gains an id; nothing that writes an audit row changes.
 */
export interface AuditActor {
  actorKind: ActorKind;
  actorId: string | null;
}

export function auditActor(actor: Actor): AuditActor {
  return isUserActor(actor)
    ? { actorKind: 'USER', actorId: actor.userId }
    : { actorKind: 'GUEST', actorId: actor.sessionId };
}

/** The payment-expiry sweep and anything else no person asked for (FR-PAY-06). */
export const SYSTEM_AUDIT: AuditActor = { actorKind: 'SYSTEM', actorId: null };

/** An operator acting through the admin screens (FR-PAY-04, FR-ADM-05). */
export const ADMIN_AUDIT: AuditActor = { actorKind: 'ADMIN', actorId: null };
