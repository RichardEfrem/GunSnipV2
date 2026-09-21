import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Promo-rail artwork for the seed (FR-PROMO-04, FR-ADM-12).
 *
 * The same reasoning as `image-placeholder.ts`, in the banner's aspect ratio: generated locally
 * and deterministically, so a demo never depends on an image host and a reseed does not churn
 * the home page's appearance.
 *
 * Until this existed the seed wrote a path shaped like an upload's without writing a file, so
 * every banner row pointed at a 404 and the admin Banners screen rendered three broken images.
 * A placeholder that exists is the honest version of that intent: the operator replaces the
 * path in admin (Banners → Edit → Image URL) when real artwork arrives, and nothing else moves.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Alongside `media/products`, for the same reason: `client/public` is what Next serves. */
const OUTPUT_DIR = join(HERE, '../../../client/public/media/banners');
const PUBLIC_PATH = '/media/banners';

/** Armor greys, matching the product plates so the rail reads as one system. */
const PLATES = ['#e6e9ed', '#dde1e7', '#d3d8e0'] as const;

/** `--core-blue` and `--sortie-red` from DESIGN.md §2.1 — navigation blue, commerce red. */
const ACCENTS = ['#1f44a6', '#d6273c', '#1f44a6'] as const;

/**
 * 3:1. The rail is a two-column grid of wide cards, and a banner cropped from a square would
 * lose the composition rather than scale it.
 */
const WIDTH = 1600;
const HEIGHT = 540;

function hash(value: string): number {
  return parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
}

export interface BannerPlaceholderInput {
  /** Derived from the banner's destination, so the file name says where it points. */
  slug: string;
  /** Printed along the bottom, the way a product plate prints its unit code. */
  code: string;
}

function svg({ slug, code }: BannerPlaceholderInput): string {
  const seed = hash(slug);
  const plate = PLATES[seed % PLATES.length];
  const accent = ACCENTS[seed % ACCENTS.length];

  const inset = 40;
  const chamfer = 56;
  const right = WIDTH - inset;
  const bottom = HEIGHT - inset;

  // Panel lines, thinning left to right, so the plate reads as machined rather than as a
  // flat rectangle waiting for a photograph. `>>>`, not `>>`: a signed shift goes negative for
  // half of all seeds and walks the line back off its column.
  const lines = Array.from({ length: 5 }, (_, i) => {
    const x = inset + 120 + i * 150 + ((seed >>> (i * 2)) % 40);
    return `<rect x="${x}" y="${inset + 90}" width="3" height="${HEIGHT - inset * 2 - 150}" fill="#c2c8d0" opacity="${0.7 - i * 0.1}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f4f5f7"/>
  <path d="M ${inset + chamfer} ${inset} H ${right} V ${bottom - chamfer} L ${right - chamfer} ${bottom} H ${inset} V ${inset + chamfer} Z" fill="${plate}"/>
  <path d="M ${inset + chamfer} ${inset} H ${right} V ${bottom - chamfer} L ${right - chamfer} ${bottom} H ${inset} V ${inset + chamfer} Z" fill="none" stroke="#c2c8d0" stroke-width="3"/>
  ${lines}
  <rect x="${inset + 60}" y="${inset + 50}" width="180" height="14" fill="${accent}"/>
  <rect x="${inset + 60}" y="${bottom - 90}" width="${WIDTH - inset * 2 - 220}" height="3" fill="#c2c8d0"/>
  <text x="${inset + 60}" y="${bottom - 46}" font-family="ui-monospace, Menlo, monospace" font-size="30" fill="#767c88">${code}</text>
</svg>`;
}

/**
 * Clears the output directory before a seed writes into it, for the same reason
 * `clearPlaceholders` does: a renamed banner would otherwise leave its old file behind forever.
 */
export async function clearBannerPlaceholders(): Promise<void> {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

export async function writeBannerPlaceholder(input: BannerPlaceholderInput): Promise<string> {
  const filename = `${input.slug}.svg`;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, filename), svg(input), 'utf8');

  return `${PUBLIC_PATH}/${filename}`;
}
