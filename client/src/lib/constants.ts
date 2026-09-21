/** Values shared across features that are not configuration and never change at runtime. */

/**
 * The guest session cookie (PRD §11.1). `proxy.ts` mints it, the API reads it, and the two
 * have to agree — so the name is written down once. Matches `SESSION_COOKIE_NAME` on the
 * server, whose default is the same string.
 */
export const SESSION_COOKIE = 'gs_session';

/** A year, matching the server's `SESSION_COOKIE_MAX_AGE_DAYS` default. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The back-office credential (PRD §11.2).
 *
 * Phase 0's admin guard compares a shared secret in the `x-admin-key` header, and that secret
 * must never reach client JavaScript — so it lives in an httpOnly cookie that only Server
 * Components and Server Actions read, and they attach the header on the operator's behalf
 * (`lib/admin-api.ts`).
 *
 * Deliberately *not* an environment variable on the web app. The API already holds the key as
 * `ADMIN_KEY`; a second copy in the storefront's environment would be a second thing to rotate
 * and a second place to leak it from. Signing in is how the key gets here, and the API is what
 * says whether it is right.
 *
 * Phase 1 replaces the contents of this cookie with a real session token. The cookie, the
 * gate in `proxy.ts` and every screen behind it stay exactly as written.
 */
export const ADMIN_COOKIE = 'gs_admin';

/** A working day. Short on purpose — this cookie carries a shared secret, not an identity. */
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Image uploads (FR-ADM-04, FR-ADM-12, FR-REV-01). The API re-encodes every one to WebP, so these
 * are about what a person can *pick*, not what is stored. The byte cap matches the server's
 * `MAX_IMAGE_BYTES`; checking it here saves someone waiting on an upload that was always going
 * to be refused.
 */
export const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const IMAGE_UPLOAD_HINT = 'JPEG, PNG or WebP, up to 8 MB. Converted to WebP on upload.';

/** Where the API serves uploaded images, proxied same-origin by `next.config.ts`. Matches `MEDIA_PUBLIC_PATH`. */
export const UPLOADED_MEDIA_PATH = '/media/uploads';

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
