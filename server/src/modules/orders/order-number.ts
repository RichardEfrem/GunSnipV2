import { randomInt } from 'node:crypto';

/**
 * `GS-YYMMDD-XXXX` (FR-ORD-01).
 *
 * The date is the store's date — `Asia/Jakarta` — not UTC: an order placed at 06:30 WIB belongs
 * to that morning, and a number stamped with yesterday's date would read as a mistake on the
 * confirmation page (CLAUDE.md Conventions: display in Asia/Jakarta).
 *
 * The suffix is random rather than a daily counter. A counter would publish the shop's order
 * volume to anyone who places two orders, and it would need a sequence row every placement
 * contends on. Random has a ceiling instead — 10,000 numbers a day — which the repository meets
 * by checking a candidate is free inside the order transaction, with the unique index behind it.
 */
const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});

export const ORDER_NUMBER_SUFFIX_SPACE = 10_000;

export function formatOrderNumber(placedAt: Date, suffix: number): string {
  if (!Number.isInteger(suffix) || suffix < 0 || suffix >= ORDER_NUMBER_SUFFIX_SPACE) {
    throw new RangeError(`Order number suffix must be 0–${ORDER_NUMBER_SUFFIX_SPACE - 1}, received ${suffix}.`);
  }

  // en-CA formats as YY-MM-DD; the parts are read by type rather than by splitting a string
  // whose separator is the locale's to choose.
  const parts = Object.fromEntries(
    JAKARTA_DATE.formatToParts(placedAt).map((part) => [part.type, part.value]),
  );

  return `GS-${parts.year}${parts.month}${parts.day}-${String(suffix).padStart(4, '0')}`;
}

/** A fresh candidate. Cryptographic only because it is the convenient uniform integer in Node. */
export function randomOrderNumber(placedAt: Date): string {
  return formatOrderNumber(placedAt, randomInt(ORDER_NUMBER_SUFFIX_SPACE));
}
