/**
 * Cuts the promo imagery from store photography: the home hero, and the promo-rail banners
 * along with the manifest the seed reads for them.
 *
 * Run by hand, like `fetch-product-images.mjs`, and for the same reason: the seed stays offline
 * and the output is committed.
 *
 *     node server/scripts/fetch-banner-images.mjs
 *
 * Files land in `client/public/media/promo`, which is committed — not `media/banners`, which
 * holds the seed's generated placeholders and is gitignored.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BANNER_SOURCES, HERO_LINEUP } from './banner-image-sources.mjs';
import { download, fetchProduct, STORE } from './store-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(HERE, '../../client/public/media/promo');
const MANIFEST = join(HERE, '../prisma/seed/data/banner-images.json');
const TOKENS = join(HERE, '../../client/src/styles/tokens.css');
const PUBLIC_PATH = '/media/promo';

/**
 * The placeholder's ratio (1600×540, see `banner-placeholder.ts`) at the width the card needs:
 * a card is half of the 1280px content column, so ~610px, and twice that on a retina screen.
 */
const WIDTH = 1200;
const HEIGHT = 405;

const JPEG = { quality: 84, mozjpeg: true };

function cover(buffer) {
  return sharp(buffer).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' }).jpeg(JPEG);
}

/** See `banner-image-sources.mjs` for when this beats a crop. */
async function compose(buffer) {
  const scaled = await sharp(buffer).resize({ height: HEIGHT }).toBuffer();
  const { width } = await sharp(scaled).metadata();
  const pad = Math.max(0, WIDTH - width);

  return sharp(scaled)
    .extend({ left: Math.floor(pad / 2), right: Math.ceil(pad / 2), extendWith: 'copy' })
    .jpeg(JPEG);
}

/**
 * Wide enough for the 1280px content column on a retina screen, at the ratio the hero box has
 * on desktop (1232 × 416).
 */
const HERO_WIDTH = 2400;
const HERO_HEIGHT = 810;
/**
 * The share of the width the text column takes on desktop — `lg:w-2/5` on the page. The lineup
 * starts where the text ends, so the text sits on the plain canvas. Change one, change both.
 */
const HERO_TEXT_SHARE = 0.4;
/** How far neighbouring columns cross-fade, in image pixels. */
const HERO_FADE = 80;

/**
 * Read from `tokens.css` rather than copied, the way `check-contrast.mjs` does: the hero's
 * canvas IS the page's --frame-900, and a copied hex would drift the first time the token moved.
 */
async function frame900() {
  const match = /--frame-900:\s*#([0-9a-f]{6})/i.exec(await readFile(TOKENS, 'utf8'));
  if (match === null) throw new Error(`--frame-900 not found in ${TOKENS}`);
  const hex = match[1];
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
}

/**
 * One kit's column: the photo at the hero's height, its black lifted onto the canvas colour
 * per channel (white stays white), cut `width` wide around the kit.
 *
 * Flattened to sRGB before the lift, because the sources carry an ICC profile and levels
 * applied to pre-profile values land somewhere else once the profile is honoured on output.
 */
async function lineupColumn({ handle, image, centre }, width, canvas) {
  const product = await fetchProduct(handle);
  const src = product.images?.[image];
  if (src === undefined) throw new Error(`hero: ${handle} has no image #${image}`);

  const srgb = await sharp(await download(src.startsWith('//') ? `https:${src}` : src)).png().toBuffer();
  const scaled = await sharp(srgb)
    .linear(canvas.map((c) => (255 - c) / 255), canvas)
    .resize({ height: HERO_HEIGHT })
    .removeAlpha()
    .toBuffer();
  const { width: scaledWidth } = await sharp(scaled).metadata();
  const left = Math.max(0, Math.min(scaledWidth - width, Math.round(scaledWidth * centre - width / 2)));

  const { data, info } = await sharp(scaled)
    .extract({ left, top: 0, width, height: HERO_HEIGHT })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels };
}

/**
 * The lineup on the right of a --frame-900 canvas, each column cross-faded into the next.
 *
 * Blended in raw pixels rather than with sharp's `composite`, so the arithmetic is on the page:
 * each column ramps in over `HERO_FADE` on its left and out on its right (the last one runs to
 * the edge). The backdrops are all the canvas colour by then, so a ramp only ever blends
 * backdrop into backdrop, or softens the edge of a wing.
 */
async function writeHero() {
  const canvas = await frame900();
  const start = Math.round(HERO_WIDTH * HERO_TEXT_SHARE);
  const count = HERO_LINEUP.length;
  // n columns overlapping by HERO_FADE fill exactly the width right of the text.
  const columnWidth = Math.round((HERO_WIDTH - start + (count - 1) * HERO_FADE) / count);
  const step = columnWidth - HERO_FADE;

  const out = Buffer.alloc(HERO_WIDTH * HERO_HEIGHT * 3);
  for (let pixel = 0; pixel < HERO_WIDTH * HERO_HEIGHT; pixel += 1) out.set(canvas, pixel * 3);

  for (const [n, source] of HERO_LINEUP.entries()) {
    const { data, channels } = await lineupColumn(source, columnWidth, canvas);
    const isLast = n === count - 1;

    for (let x = 0; x < columnWidth; x += 1) {
      const target = start + n * step + x;
      if (target >= HERO_WIDTH) break;
      const alpha = Math.min(1, x / HERO_FADE, isLast ? 1 : (columnWidth - 1 - x) / HERO_FADE);

      for (let y = 0; y < HERO_HEIGHT; y += 1) {
        const o = (y * HERO_WIDTH + target) * 3;
        const s = (y * columnWidth + x) * channels;
        for (let c = 0; c < 3; c += 1) out[o + c] = Math.round(out[o + c] * (1 - alpha) + data[s + c] * alpha);
      }
    }
    console.log(`  ok    hero  ${source.handle} #${source.image}`);
  }

  await sharp(out, { raw: { width: HERO_WIDTH, height: HERO_HEIGHT, channels: 3 } })
    .jpeg(JPEG)
    .toFile(join(OUTPUT_DIR, 'hero.jpg'));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeHero();

  const manifest = {};

  for (const [slug, { handle, image, fit, alt }] of Object.entries(BANNER_SOURCES)) {
    const product = await fetchProduct(handle);
    const src = product.images?.[image];
    // Fail rather than quietly take another shot: the alt above describes this exact photo.
    if (src === undefined) throw new Error(`${slug}: ${handle} has no image #${image}`);

    const buffer = await download(src.startsWith('//') ? `https:${src}` : src);
    const filename = `${slug}.jpg`;
    const pipeline = fit === 'compose' ? await compose(buffer) : cover(buffer);
    await pipeline.toFile(join(OUTPUT_DIR, filename));

    manifest[slug] = { source: `${STORE}/products/${handle}`, url: `${PUBLIC_PATH}/${filename}`, alt };
    console.log(`  ok    ${slug}  (${fit})`);
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\n${Object.keys(manifest).length} banners written`);
}

await main();
