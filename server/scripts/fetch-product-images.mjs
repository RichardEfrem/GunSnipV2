/**
 * Downloads real catalogue photography and writes the manifest the seed reads.
 *
 * Run by hand, never as part of a build or a seed:
 *
 *     node server/scripts/fetch-product-images.mjs
 *
 * The seed itself stays offline. This script is the only thing that touches the network, its
 * output is committed, and `npm run seed` reads that output — so a reseed on a plane produces
 * the same catalogue as a reseed on a desk, which is the property `image-placeholder.ts` was
 * protecting when it chose to generate rather than fetch.
 *
 * Images land in `client/public/media/catalogue`, which is committed, NOT in
 * `client/public/media/products`, which is gitignored and wiped on every seed.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SOURCES, UNAVAILABLE } from './product-image-sources.mjs';
import { download, fetchProduct, pause, sized, STORE } from './store-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(HERE, '../../client/public/media/catalogue');
const MANIFEST = join(HERE, '../prisma/seed/data/product-images.json');
const PUBLIC_PATH = '/media/catalogue';

/** Enough for a gallery without turning the repository into a photo library. */
const MAX_IMAGES = 3;
const EDGE = 1000;

/**
 * Square, white-matted, JPEG. The grid lays every card out on a 1:1 tile, and the source shots
 * are a mix of square studio plates and letterboxed box art — `contain` keeps a wide box shot
 * from being cropped through its own artwork.
 */
async function normalise(buffer, destination) {
  await sharp(buffer)
    .resize(EDGE, EDGE, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(destination);
}

/** A real 8px blur beats the flat wash the placeholder had to settle for (DESIGN.md §7). */
async function blurDataUrl(buffer) {
  const tiny = await sharp(buffer).resize(8, 8, { fit: 'fill' }).webp({ quality: 60 }).toBuffer();
  return `data:image/webp;base64,${tiny.toString('base64')}`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const manifest = {};
  const failures = [];

  for (const [slug, handle] of Object.entries(SOURCES)) {
    try {
      const product = await fetchProduct(handle);
      const sources = (product.images ?? []).slice(0, MAX_IMAGES);
      if (sources.length === 0) throw new Error('no images on source product');

      const images = [];
      for (const [index, src] of sources.entries()) {
        const buffer = await download(sized(src, EDGE));

        const filename = `${slug}-${index}.jpg`;
        await normalise(buffer, join(OUTPUT_DIR, filename));
        images.push({ url: `${PUBLIC_PATH}/${filename}`, blurDataUrl: await blurDataUrl(buffer) });
      }

      manifest[slug] = { source: `${STORE}/products/${handle}`, images };
      console.log(`  ok    ${slug}  (${images.length})`);
    } catch (error) {
      failures.push({ slug, handle, reason: error.message });
      console.log(`  FAIL  ${slug}  — ${error.message}`);
    }
    await pause(150);
  }

  // Sorted, so a re-run produces a diff that reflects real changes rather than object order.
  const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

  console.log(`\n${Object.keys(ordered).length} products with photography`);
  console.log(`${Object.keys(UNAVAILABLE).length} keeping placeholders (see product-image-sources.mjs)`);
  if (failures.length) {
    console.log(`\n${failures.length} failed:`);
    for (const f of failures) console.log(`  ${f.slug} -> ${f.handle}: ${f.reason}`);
    process.exitCode = 1;
  }
}

await main();
