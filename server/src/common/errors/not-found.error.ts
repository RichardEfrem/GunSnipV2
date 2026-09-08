import { DomainError } from './domain-error.js';

/** The thing asked for does not exist, or is not visible to this actor. Maps to 404. */
export class NotFoundError extends DomainError {
  readonly code: string = 'NOT_FOUND';
}
