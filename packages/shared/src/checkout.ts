/**
 * The checkout contract both sides have to agree on (FR-CO-07, FR-ORD-01).
 */

/**
 * The header `POST /orders` requires (FR-CO-07). The browser mints one per checkout attempt; a
 * repeat of the same request with the same key returns the order the first one created.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * `GS-YYMMDD-XXXX` (FR-ORD-01). The track-order form checks a pasted number against this before
 * asking the API, and the API checks it before asking the database.
 */
export const ORDER_NUMBER_PATTERN = /^GS-\d{6}-\d{4}$/;

/**
 * An Indonesian mobile number, after spaces and dashes are stripped: `08…`, `628…` or `+628…`.
 * Mobile, because the courier calls or messages it on delivery — a landline cannot take either.
 */
export const PHONE_PATTERN = /^(?:\+62|62|0)8\d{7,11}$/;

/** Indonesian postal codes are five digits. */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/**
 * Field lengths the checkout form and `POST /orders` both enforce, so the browser stops at the
 * same character the API would reject. Generous for real input; the point is a bound, not a squeeze.
 */
export const CHECKOUT_FIELD_LIMITS = {
  name: 100,
  email: 254,
  street: 200,
  notes: 200,
} as const;

/** The most lines one order may carry — a bound on the transaction, far above a real basket. */
export const MAX_LINES_PER_ORDER = 50;
