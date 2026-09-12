import { ApiError } from '@/lib/api-error';
import { formatIdr } from '@/lib/formatters';
import { rateLimitedDetailsSchema, totalChangedDetailsSchema } from './schema';

/**
 * A refused order, as a sentence that says what happens next (DESIGN.md §4.5, §5).
 *
 * The API's domain refusals are already written for a customer — "Only 1 of MG 1/100 Gundam Exia
 * left." — and are shown as they stand. A changed total carries its amount as an integer, so it
 * is worded here, where money becomes a string (CLAUDE.md non-negotiable #1).
 */
export function orderErrorMessage(cause: unknown): string {
  if (!(cause instanceof ApiError)) return "The order didn't go through. Try again in a moment.";

  // The request may or may not have reached the API. Pressing again is safe — the same
  // Idempotency-Key goes with it — and saying so is what makes a customer willing to.
  if (cause.status === 0) {
    return "Couldn't confirm the order reached us. Place it again — you won't be charged twice.";
  }

  if (cause.code === 'TOTAL_CHANGED') {
    const details = totalChangedDetailsSchema.safeParse(cause.details);
    if (details.success) {
      return `The total is now ${formatIdr(details.data.totalIdr)}. Check the summary, then place the order again.`;
    }
  }

  // "Wait a moment" is true but unactionable when the wait is minutes; the API says how long.
  if (cause.code === 'RATE_LIMITED') {
    const details = rateLimitedDetailsSchema.safeParse(cause.details);
    if (details.success) {
      return `Too many attempts from this connection. Try again in ${formatWait(details.data.retryAfterSeconds)}.`;
    }
  }

  // The DTO's field list is for developers; the form has already checked each field.
  if (cause.code === 'VALIDATION_FAILED' && Array.isArray(cause.details?.fields)) {
    return 'Some details need another look. Check the form and place the order again.';
  }

  if (cause.status < 500) return cause.message;

  // A 5xx can come after the commit, so this is as uncertain as a dropped connection.
  return "Couldn't confirm the order. Place it again in a moment — you won't be charged twice.";
}

/** Rounded up to whole minutes past a minute — a countdown to the second reads as a punishment. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? 'a minute' : `${minutes} minutes`;
}

/**
 * Whether the refusal means the summary on screen is out of date — the cart, a price or stock
 * moved — so the page should be re-rendered from the server before the customer tries again.
 */
export function isStaleCheckout(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.status === 409 || cause.status === 404);
}

/**
 * Whether a retry should reuse the attempt's `Idempotency-Key`. Only when the outcome is unknown:
 * a refusal is a definite "no order", and the corrected request that follows is a new attempt.
 */
export function isOutcomeUnknown(cause: unknown): boolean {
  return cause instanceof ApiError ? cause.status === 0 || cause.status >= 500 : true;
}
