/**
 * The render layer. Money is an integer everywhere else in the system (CLAUDE.md
 * non-negotiable #1) and only becomes a string here.
 */

/**
 * IDR is a zero-decimal currency in practice: `price_idr` holds whole rupiah, so 1250000
 * renders as `Rp 1.250.000` (PRD A2). There is no sen handling to write, and adding one
 * later would be a schema change, not a formatter change.
 *
 * The separator comes from `id-ID` but the symbol is prefixed by hand — ICU has moved the
 * space between `Rp` and the digits between versions, and the PRD specifies the exact string.
 */
const RUPIAH = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatIdr(amountIdr: number): string {
  if (!Number.isInteger(amountIdr)) {
    // A fractional amount means money became a float somewhere upstream, which is the one
    // bug class this project refuses to render past.
    throw new TypeError(`Money must be an integer number of rupiah, received ${amountIdr}`);
  }

  return `Rp ${RUPIAH.format(amountIdr)}`;
}

/** `142` · `1.2k` · `12.4k` — review counts and units sold (DESIGN.md §3.4). */
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return value < 1000 ? String(value) : COMPACT.format(value).toLowerCase();
}

/**
 * Whole-percent saving off the compare-at price. Returns null when there is nothing to show,
 * so a caller cannot render a `-0%` badge — the discount badge only exists when
 * `compare_at_price` does (DESIGN.md §4.3).
 */
export function discountPercent(priceIdr: number, compareAtPriceIdr: number | null): number | null {
  if (compareAtPriceIdr === null || compareAtPriceIdr <= priceIdr) return null;

  const percent = Math.round((1 - priceIdr / compareAtPriceIdr) * 100);
  return percent > 0 ? percent : null;
}

/** `4.8` — one decimal, always, so ratings align down a column. */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Dates are UTC in the database and rendered in `Asia/Jakarta` (CLAUDE.md Conventions) — the
 * store's timezone, so "placed today" means what the customer thinks it means.
 */
const JAKARTA = 'Asia/Jakarta';

const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: JAKARTA, dateStyle: 'medium' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: JAKARTA,
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(value: Date | string): string {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value));
}

/**
 * A courier's delivery window: `1–2 days` · `1 day` · `same day`. Numbers, not "fast"
 * (DESIGN.md §5). The cart's estimate, the checkout options and a placed order all say it this way.
 */
export function formatDeliveryDays(minDays: number, maxDays: number): string {
  if (maxDays === 0) return 'same day';
  if (minDays === maxDays) return `${minDays} ${minDays === 1 ? 'day' : 'days'}`;
  return `${minDays}–${maxDays} days`;
}

/**
 * When a parcel arrives, counted from payment — which is when the courier is booked. One
 * sentence for the delivery options, the checkout summary and a placed order, so the promise is
 * worded the same at every step: `Arrives 1–2 days after payment` · `Arrives the day you pay`.
 */
export function formatDeliveryPromise(minDays: number, maxDays: number): string {
  return maxDays === 0 ? 'Arrives the day you pay' : `Arrives ${formatDeliveryDays(minDays, maxDays)} after payment`;
}

/** `23:47:12` — the payment expiry countdown (DESIGN.md §3.8). */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const parts = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];

  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}
