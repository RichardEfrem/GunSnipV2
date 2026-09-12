/**
 * The mail render layer. Money is an integer everywhere else in the system (CLAUDE.md
 * non-negotiable #1) and only becomes a string here.
 *
 * A second implementation of the storefront's `formatIdr` rather than a shared one, and
 * deliberately: the two render into different media. The web app formats for a browser whose
 * user may be anywhere; a mail is composed once, on the server, in the store's own locale and
 * timezone, and pulling both onto one helper would make a change for one a change for the other.
 * They agree on the output because the PRD specifies the output, not because they share a file.
 */
const RUPIAH = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatIdr(amountIdr: number): string {
  if (!Number.isInteger(amountIdr)) {
    throw new TypeError(`Money must be an integer number of rupiah, received ${amountIdr}`);
  }

  return `Rp ${RUPIAH.format(amountIdr)}`;
}

/** Dates are UTC in the database and read in `Asia/Jakarta` (CLAUDE.md Conventions). */
const JAKARTA = 'Asia/Jakarta';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: JAKARTA,
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** `12 Sep 2026, 17:30 WIB` — the timezone is spelled out because a mail is read anywhere. */
export function formatJakarta(at: Date): string {
  return `${DATE_TIME.format(at)} WIB`;
}

/**
 * Pads a label so the amounts in a totals block line up in a monospaced client and read as a
 * column in a proportional one. Plain text has no table; this is the whole of the layout.
 */
export function padLabel(label: string, width = 12): string {
  return label.padEnd(width, ' ');
}
