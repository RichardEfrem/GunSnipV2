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
