import { DomainError } from './domain-error.js';

/** No usable credentials were presented. Maps to 401. */
export class UnauthorizedError extends DomainError {
  readonly code: string = 'UNAUTHORIZED';
}
