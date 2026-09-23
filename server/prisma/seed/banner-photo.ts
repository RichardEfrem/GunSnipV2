import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Real promo-rail artwork, for the banners that have any.
 *
 * The banner counterpart of `product-photo.ts`: `scripts/fetch-banner-images.mjs` writes the
 * manifest and the files, both are committed, and the seed reads them offline. A banner missing
 * here falls back to its generated placeholder.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'data/banner-images.json');

export interface BannerPhoto {
  url: string;
  /** Describes this photo. The seed's own alt describes the scene a placeholder stands in for. */
  alt: string;
}

/** Parsed defensively for the same reason as the product manifest: it is generated. */
export async function loadBannerPhotos(): Promise<Map<string, BannerPhoto>> {
  const parsed: unknown = JSON.parse(await readFile(MANIFEST, 'utf8'));

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${MANIFEST} is not an object — regenerate it with scripts/fetch-banner-images.mjs`);
  }

  const photos = new Map<string, BannerPhoto>();

  for (const [slug, entry] of Object.entries(parsed as Record<string, Partial<BannerPhoto>>)) {
    if (typeof entry?.url !== 'string' || typeof entry.alt !== 'string') {
      throw new Error(`Banner image manifest entry "${slug}" needs a url and an alt`);
    }
    photos.set(slug, { url: entry.url, alt: entry.alt });
  }

  return photos;
}
