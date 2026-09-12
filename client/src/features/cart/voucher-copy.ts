import { formatDate, formatIdr } from '@/lib/formatters';
import type { VoucherRejection } from './schema';

/**
 * Why a voucher cannot be used, as a sentence that says what to do next (FR-CART-06).
 *
 * "Spend Rp 155.000 more" is a reason a customer can act on; "Invalid voucher" is not. Dates are
 * rendered in the store's timezone and money in rupiah, both here and nowhere earlier (CLAUDE.md
 * Conventions, non-negotiable #1).
 */
export function voucherRejectionText(code: string, rejection: VoucherRejection): string {
  switch (rejection.reason) {
    case 'NOT_FOUND':
      return `No voucher matches ${code}. Check the spelling.`;
    case 'INACTIVE':
      return `${code} is no longer available.`;
    case 'NOT_STARTED':
      return `${code} starts on ${formatDate(rejection.startsAt)}.`;
    case 'EXPIRED':
      return `${code} ended on ${formatDate(rejection.endsAt)}.`;
    case 'USAGE_LIMIT_REACHED':
      return `${code} has been fully claimed.`;
    case 'SESSION_LIMIT_REACHED':
      return `You've already used ${code}.`;
    case 'NOTHING_SELECTED':
      return `Select an item to use ${code}.`;
    case 'NO_ELIGIBLE_ITEMS':
      return `${code} doesn't cover anything selected in your cart.`;
    case 'MIN_SPEND_NOT_MET':
      return `Spend ${formatIdr(rejection.shortfallIdr)} more to use ${code} — it needs ${formatIdr(rejection.minSpendIdr)} of eligible items.`;
  }
}
