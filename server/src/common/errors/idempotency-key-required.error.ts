import { ValidationError } from './validation.error.js';

/**
 * A request that must be retry-safe arrived without a usable `Idempotency-Key` (FR-CO-07,
 * CLAUDE.md). Refused outright rather than processed without one: an order endpoint that is only
 * idempotent when the client remembers is not idempotent.
 */
export class IdempotencyKeyRequiredError extends ValidationError {
  override readonly code: string = 'IDEMPOTENCY_KEY_REQUIRED';

  constructor() {
    super('An Idempotency-Key header of 16–128 letters, digits, - or _ is required.');
  }
}
