/**
 * Read access to the storefront the catalogue photography comes from.
 *
 * Shared by `fetch-product-images.mjs` and `fetch-banner-images.mjs`. Both are run by hand and
 * their output is committed — the seed never calls this.
 */

export const STORE = 'https://www.gundamplanet.com';

const HEADERS = { 'user-agent': 'Mozilla/5.0' };
const ATTEMPTS = 4;

/**
 * `fetch` with a few retries. A run makes a few hundred requests, and the CDN drops the odd
 * connection (ECONNRESET) — one of those should not abort a run halfway through its downloads.
 */
export async function request(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return res;
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

/** Shopify's public product JSON: `images` is the gallery, in the store's own order. */
export async function fetchProduct(handle) {
  const res = await request(`${STORE}/products/${handle}.js`);
  return res.json();
}

/** Shopify resizes on its CDN, so a run never pulls the 3000px original to throw most of it away. */
export function sized(src, width) {
  const url = new URL(src.startsWith('//') ? `https:${src}` : src);
  url.searchParams.set('width', String(width));
  return url.toString();
}

export async function download(url) {
  const res = await request(url);
  return Buffer.from(await res.arrayBuffer());
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
