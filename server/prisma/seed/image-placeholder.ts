import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Product imagery for the seed.
 *
 * Generated locally and deterministically rather than fetched: an external image host is a
 * dependency that breaks a demo months later, and stock photos of someone else's product
 * boxes are not ours to redistribute. The same slug always produces the same image, so a
 * reseed does not churn the catalogue's appearance.
 *
 * These are honestly placeholders — panel-lined plates in the DESIGN.md palette, marked with
 * the grade and unit code. They read as deliberate art direction rather than as a broken
 * image, which matters because they are what the whole storefront is rendered against until
 * real photography exists.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The web app serves these. Writing across the package boundary is deliberate and is the
 * whole reason there is no image host: `client/public` is the only directory Next serves
 * statically, and a URL under it behaves exactly like the CDN path that replaces it later.
 */
const OUTPUT_DIR = join(HERE, '../../../client/public/media/products');
const PUBLIC_PATH = '/media/products';

/** Armor greys, so a placeholder never competes with the plastic colours it stands in for. */
const PLATES = ['#e6e9ed', '#dde1e7', '#d3d8e0', '#c9cfd8', '#eef0f3'] as const;

/** One accent per grade, matching the badge it will sit next to. */
const ACCENTS: Record<string, string> = {
  EG: '#1e8e5a',
  SD: '#b4630f',
  HG: '#1f44a6',
  RG: '#7b2d8e',
  MG: '#1f44a6',
  MGEX: '#0f6b8c',
  PG: '#98101f',
  FM: '#3a404b',
  RE100: '#3a404b',
  HIRM: '#3a404b',
  MEGA: '#3a404b',
  TOOL: '#23272f',
};

function hash(value: string): number {
  return parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
}

export interface PlaceholderInput {
  slug: string;
  /** Grade code for a kit, or 'TOOL' for a tool. Drives the accent and the corner mark. */
  mark: string;
  /** Machine identifier printed along the bottom — unit code or SKU. */
  code: string;
  /** Distinguishes the gallery shots of one product. */
  index: number;
}

export interface Placeholder {
  url: string;
  blurDataUrl: string;
}

function svg({ slug, mark, code, index }: PlaceholderInput): string {
  const seed = hash(`${slug}:${index}`);
  const plate = PLATES[seed % PLATES.length];
  const accent = ACCENTS[mark] ?? ACCENTS.TOOL;

  // Vary the composition per shot so a gallery is not five identical frames.
  const offset = 60 + (seed % 5) * 22;
  const runners = 3 + (seed % 3);
  const chamfer = 64;

  const lines = Array.from({ length: runners }, (_, i) => {
    const y = 300 + i * (400 / runners);
    const width = 240 + ((seed >> (i * 3)) % 5) * 60;
    return `<rect x="${offset + 40}" y="${y}" width="${width}" height="18" rx="2" fill="#ffffff" opacity="0.65"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img">
  <rect width="1000" height="1000" fill="#f4f5f7"/>
  <path d="M ${offset + chamfer} ${offset} H ${1000 - offset} V ${1000 - offset - chamfer} L ${1000 - offset - chamfer} ${1000 - offset} H ${offset} V ${offset + chamfer} Z" fill="${plate}"/>
  <path d="M ${offset + chamfer} ${offset} H ${1000 - offset} V ${1000 - offset - chamfer} L ${1000 - offset - chamfer} ${1000 - offset} H ${offset} V ${offset + chamfer} Z" fill="none" stroke="#c2c8d0" stroke-width="3"/>
  <rect x="${offset + 40}" y="${offset + 60}" width="${880 - offset * 2}" height="3" fill="#c2c8d0"/>
  ${lines}
  <rect x="${1000 - offset - 150}" y="${offset + 40}" width="110" height="46" fill="${accent}"/>
  <text x="${1000 - offset - 95}" y="${offset + 72}" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">${mark}</text>
  <text x="${offset + 40}" y="${1000 - offset - 40}" font-family="ui-monospace, Menlo, monospace" font-size="26" fill="#767c88">${code}</text>
</svg>`;
}

/**
 * An 8×8 wash of the plate colour. next/image paints this while the real file loads, so the
 * card never flashes empty — the stored value is what DESIGN.md §7 calls for.
 */
function blurDataUrl(plate: string): string {
  const tiny = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${plate}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(tiny).toString('base64')}`;
}

/**
 * Clears the output directory before a seed writes into it.
 *
 * Filenames are derived from product slugs, so without this a renamed or removed product
 * leaves its old images behind forever — invisible locally, and eventually a directory whose
 * contents nobody can account for.
 */
export async function clearPlaceholders(): Promise<void> {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
}

export async function writePlaceholder(input: PlaceholderInput): Promise<Placeholder> {
  const filename = `${input.slug}-${input.index}.svg`;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, filename), svg(input), 'utf8');

  return {
    url: `${PUBLIC_PATH}/${filename}`,
    blurDataUrl: blurDataUrl(PLATES[hash(`${input.slug}:${input.index}`) % PLATES.length]),
  };
}
