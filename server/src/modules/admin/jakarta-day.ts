/**
 * The UTC instant that the store's current day began (FR-ADM-01, PRD A1).
 *
 * "Today's orders" means the operator's today, which is `Asia/Jakarta` — the same reasoning that
 * puts the Jakarta date in an order number (`order-number.ts`). At 06:30 WIB the UTC day is
 * still yesterday, so a dashboard built on `new Date().setUTCHours(0,0,0,0)` would show an empty
 * morning every day until lunchtime and then quietly double-count the evening.
 *
 * WIB is UTC+7 with no daylight saving and no historical changes in the range this shop cares
 * about, but the offset is read from `Intl` rather than hardcoded: a constant 7 is a fact about
 * the timezone database, not about this code, and the place it would break is a date arithmetic
 * bug nobody looks for.
 */
const JAKARTA_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function startOfJakartaDay(now: Date): Date {
  const parts = Object.fromEntries(JAKARTA_PARTS.formatToParts(now).map((part) => [part.type, part.value]));

  // How far into its own day Jakarta is, in milliseconds. Subtracting that from `now` lands
  // exactly on local midnight without ever constructing a date in a timezone Node cannot parse.
  const millisecondsIntoDay =
    (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();

  return new Date(now.getTime() - millisecondsIntoDay);
}
