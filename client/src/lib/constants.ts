/** Values shared across features that are not configuration and never change at runtime. */

/**
 * The guest session cookie (PRD §11.1). `proxy.ts` mints it, the API reads it, and the two
 * have to agree — so the name is written down once. Matches `SESSION_COOKIE_NAME` on the
 * server, whose default is the same string.
 */
export const SESSION_COOKIE = 'gs_session';

/** A year, matching the server's `SESSION_COOKIE_MAX_AGE_DAYS` default. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Row 2 of the header collapses past this scroll offset (DESIGN.md §4.1). */
export const HEADER_COLLAPSE_OFFSET = 200;

/**
 * `--frame-900`, duplicated as a literal because `<meta name="theme-color">` cannot read a CSS
 * variable. The header, footer and tab bar are this colour in both themes, so the browser
 * chrome matches whichever theme is showing.
 *
 * `scripts/check-contrast.mjs` asserts this equals the token, so the copy cannot go stale.
 */
export const BROWSER_THEME_COLOR = '#14161b';
