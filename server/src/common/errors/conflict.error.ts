import { DomainError } from './domain-error.js';

/**
 * The request collides with current state — stock ran out, the order already shipped, the
 * transition is illegal. Maps to 409.
 */
export class ConflictError extends DomainError {
  readonly code: string = 'CONFLICT';
}
