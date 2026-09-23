import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Real catalogue photography, for the products that have any.
 *
 * The manifest and the files it points at are both committed, and `scripts/fetch-product-images.mjs`
 * is the only thing that ever writes them. The seed stays offline and deterministic — the
 * property `image-placeholder.ts` was protecting when it chose to generate rather than fetch —
 * while the storefront still renders against real plastic.
 *
 * Not every product has a photograph. A slug missing here falls back to the generated
 * placeholder, which is why that module is still the one the seed reaches for by default.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'data/product-images.json');

export interface ProductPhoto {
  url: string;
  blurDataUrl: string;
}

interface ManifestEntry {
  /** The product page the shots came from, kept so their provenance is auditable. */
  source: string;
  images: ProductPhoto[];
}

/**
 * Read once per seed rather than per product. Parsed defensively because this file is
 * generated: a truncated write should fail the seed loudly, not silently drop the imagery.
 */
export async function loadProductPhotos(): Promise<Map<string, ProductPhoto[]>> {
  const raw = await readFile(MANIFEST, 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${MANIFEST} is not an object — regenerate it with scripts/fetch-product-images.mjs`);
  }

  const photos = new Map<string, ProductPhoto[]>();

  for (const [slug, entry] of Object.entries(parsed as Record<string, ManifestEntry>)) {
    if (!Array.isArray(entry?.images) || entry.images.length === 0) {
      throw new Error(`Product image manifest has no images for "${slug}"`);
    }
    photos.set(slug, entry.images);
  }

  return photos;
}
