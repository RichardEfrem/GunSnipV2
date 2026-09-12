import { formatIdr } from '@/lib/formatters';
import type { CartLine, CartNotice } from './schema';

/**
 * The sentences FR-CART-04 promises, from the structured notices the server sends.
 *
 * Worded here rather than on the server because two of them carry money, and money becomes a
 * string only at the render layer (CLAUDE.md non-negotiable #1). Numbers over adjectives, and no
 * apology (DESIGN.md §5): "Only 2 left — quantity reduced to 2", not "Almost gone!".
 */
export function noticeText(notice: CartNotice, line: CartLine): string {
  switch (notice.kind) {
    case 'PRICE_CHANGED':
      return `Price changed from ${formatIdr(notice.previousUnitPriceIdr)}.`;
    case 'QUANTITY_REDUCED':
      return `Only ${line.availableQuantity} left — quantity reduced to ${line.quantity}.`;
    case 'OUT_OF_STOCK':
      return 'Out of stock. Kept in your cart, not counted in the total.';
    case 'UNAVAILABLE':
      return 'No longer sold. Not counted in the total.';
  }
}
