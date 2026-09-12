import { ApiError } from '@/lib/api-error';
import { voucherRejectedDetailsSchema } from './schema';
import { voucherRejectionText } from './voucher-copy';

/**
 * A failed cart request, as a sentence fit to show a customer (DESIGN.md §4.5, §5).
 *
 * The API's domain errors are already written for a customer ("Only 2 of Mr. Top Coat left"),
 * so they are shown as-is. Anything else gets a plain line rather than a stack trace, and never
 * an apology.
 */
export function cartErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.status !== 0 && cause.status < 500) return cause.message;
  if (cause instanceof ApiError && cause.status === 0) return "Couldn't reach the store. Your cart hasn't changed.";

  return "That didn't save. Try again in a moment.";
}

/**
 * A rejected voucher, worded from its structured reason (FR-CART-06). The server says *why*; the
 * copy — and the formatting of any amount or date in it — belongs here.
 */
export function voucherErrorMessage(code: string, cause: unknown): string {
  if (cause instanceof ApiError && cause.code === 'VOUCHER_REJECTED') {
    const details = voucherRejectedDetailsSchema.safeParse(cause.details);
    if (details.success) return voucherRejectionText(details.data.code, details.data);
  }

  // The DTO's shape check, before any lookup: spaces, punctuation, a code too long to exist.
  if (cause instanceof ApiError && cause.code === 'VALIDATION_FAILED') {
    return 'Voucher codes are letters and numbers only.';
  }

  return cartErrorMessage(cause);
}
