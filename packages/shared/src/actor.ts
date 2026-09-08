import type { Role } from './enums/role.js';

/**
 * Who is making a request (PRD §11.1). No service anywhere takes a `userId` — it takes an
 * Actor. Phase 0 only ever mints the guest arm; Phase 1 adds the user arm by extending the
 * guard that resolves it, and nothing downstream changes shape.
 */
export type Actor =
  | { kind: 'guest'; sessionId: string }
  | { kind: 'user'; sessionId: string; userId: string; roles: Role[] };

/** Narrows to the authenticated arm. Phase 0 never returns true. */
export function isUserActor(actor: Actor): actor is Extract<Actor, { kind: 'user' }> {
  return actor.kind === 'user';
}

/**
 * How rows owned by an actor are found: by `user_id` when there is one, otherwise by
 * `session_id` (PRD §11.1). Repositories translate this into a where clause.
 */
export type ActorScope = { userId: string; sessionId?: undefined } | { sessionId: string; userId?: undefined };

export function actorScope(actor: Actor): ActorScope {
  return isUserActor(actor) ? { userId: actor.userId } : { sessionId: actor.sessionId };
}
