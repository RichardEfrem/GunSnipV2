import { DomainError } from './domain-error.js';

/** The actor is known but not allowed to do this. Maps to 403. */
export class ForbiddenError extends DomainError {
  readonly code: string = 'FORBIDDEN';
}
