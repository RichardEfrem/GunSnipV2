import { DomainError } from './domain-error.js';

/**
 * The request was well-formed but breaks a business rule — a voucher below its minimum spend,
 * a quantity over the per-order cap. Distinct from DTO validation, which never reaches a
 * service. Maps to 400.
 */
export class ValidationError extends DomainError {
  readonly code: string = 'VALIDATION_FAILED';
}
