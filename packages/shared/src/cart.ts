/**
 * Limits the cart enforces, shared because the stepper that bounds a quantity and the service
 * that rejects one have to agree (FR-PDP-06, FR-CART-02).
 *
 * The client uses them to stop the click; the server uses them to decide what is allowed. Only
 * the second is authoritative — a bound the browser could edit is a hint, not a rule.
 */

/**
 * Per-line cap, independent of stock. A scalper ordering forty of a limited release is not a
 * customer the store wants to serve, and availability alone does not stop them: a restock of
 * two hundred would let it through.
 */
export const MAX_QUANTITY_PER_LINE = 10;

/**
 * What changed about a line since it was added (FR-CART-04, DESIGN.md §3.6).
 *
 * The server derives these on every read and the storefront turns them into sentences; neither
 * side ever applies a change silently. Kinds rather than finished copy, because two of them
 * carry money and money is only formatted at the render layer (CLAUDE.md non-negotiable #1).
 *
 * - `PRICE_CHANGED`    the variant's price is no longer what the customer was shown at add time
 * - `QUANTITY_REDUCED` less stock than the line asks for; the line counts only what exists
 * - `OUT_OF_STOCK`     none left; the line stays as a shortlist entry, outside the total
 * - `UNAVAILABLE`      archived or unpublished; the line cannot be bought at all
 */
export const CART_NOTICE_KINDS = [
  'PRICE_CHANGED',
  'QUANTITY_REDUCED',
  'OUT_OF_STOCK',
  'UNAVAILABLE',
] as const;

export type CartNoticeKind = (typeof CART_NOTICE_KINDS)[number];
