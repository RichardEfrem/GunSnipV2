import localFont from 'next/font/local';

/**
 * One superfamily, three roles (DESIGN.md §2.2). Self-hosted rather than fetched at runtime,
 * so there is no third-party connection on the critical path and the faces cannot change
 * under us.
 *
 * Latin subset only — the interface language is English (PRD A3). Each file is the `latin`
 * unicode-range slice, ~10–19KB.
 */

/** Headings, product titles, nav, prices, buttons. Condensed because a product title has to
 *  fit two lines in a five-across grid. */
export const plexCondensed = localFont({
  src: [{ path: './plex-condensed-600.woff2', weight: '600', style: 'normal' }],
  variable: '--font-plex-condensed',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/** Descriptions, labels, help text. */
export const plexSans = localFont({
  src: [
    { path: './plex-sans-400.woff2', weight: '400', style: 'normal' },
    { path: './plex-sans-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/**
 * Machine identifiers only — SKU, order number, unit code, runner tag. Never generic small
 * labels (DESIGN.md §2.2). Not preloaded: no machine identifier appears above the fold on the
 * home page, so it loads when a page that needs it asks.
 */
export const plexMono = localFont({
  src: [{ path: './plex-mono-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
});

export const fontVariables = `${plexCondensed.variable} ${plexSans.variable} ${plexMono.variable}`;
