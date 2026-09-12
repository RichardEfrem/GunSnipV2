import { DomainError } from './domain-error.js';

/**
 * The caller is going too fast for a rate-limited endpoint (PRD §12 Security). Maps to 429.
 *
 * `retryAfterSeconds` is in `details` as well as the `Retry-After` header, so a client that
 * parses only our error body — which is every client we write — can still count down.
 */
export class TooManyRequestsError extends DomainError {
  readonly code: string = 'RATE_LIMITED';

  constructor(message: string, retryAfterSeconds: number) {
    super(message, { retryAfterSeconds });
  }
}
