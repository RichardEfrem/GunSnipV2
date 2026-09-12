import type { CartNotice } from '@/features/cart/schema';
import { formatIdr } from '@/lib/formatters';
import type { CheckoutLine } from './schema';

/**
 * What changed about a line since it was added, worded for checkout (FR-CART-04, DESIGN.md §3.7).
 *
 * The same notices the cart shows, in a sentence that says what *this order* will do about them —
 * the cart says a quantity was reduced; checkout says how many are being ordered.
 */
export function checkoutNoticeText(notice: CartNotice, line: CheckoutLine): string {
  switch (notice.kind) {
    case 'PRICE_CHANGED':
      return `Price changed from ${formatIdr(notice.previousUnitPriceIdr)}.`;
    case 'QUANTITY_REDUCED':
      return `Only ${line.quantity} left — ordering ${line.quantity} of the ${notice.requestedQuantity} in your cart.`;
    // A quote leaves out lines that cannot be bought, so these two never reach checkout; they are
    // worded anyway so the switch covers every notice the schema allows.
    case 'OUT_OF_STOCK':
      return 'Out of stock.';
    case 'UNAVAILABLE':
      return 'No longer sold.';
  }
}
