import { ConflictError } from '../../../common/errors/conflict.error.js';

/**
 * An `Idempotency-Key` presented again with a different request, or by a different session
 * (FR-CO-07).
 *
 * A repeat is only a repeat if it is the same request. Answering a different body with the order
 * the key first created would hide a client bug; answering another session with it would hand
 * one customer another's order.
 */
export class IdempotencyKeyReusedError extends ConflictError {
  override readonly code: string = 'IDEMPOTENCY_KEY_REUSED';

  constructor() {
    super('This checkout attempt was already used for a different order. Reload checkout and try again.');
  }
}
