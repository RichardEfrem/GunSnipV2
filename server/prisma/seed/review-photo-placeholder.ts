import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pruneOrphans } from './placeholder-files.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builder photos attached to seeded reviews (FR-REV-01, FR-REV-05).
 *
 * The photos-only filter and the review card's photo strip are both real UI with no data
 * behind them on a fresh seed — `withPhotosCount` was always zero, so the filter could only
 * ever show its empty state and the strip never rendered at all.
 *
 * Generated on the same terms as `image-placeholder.ts`: keyed off the product slug rather
 * than the review's generated id, so a reseed produces the same photos, and honestly a
 * placeholder. Deliberately *not* the product plate — a review photo is someone's finished
 * build on their desk, so these are darker, off-square and cropped, and read at a glance as a
 * different kind of image from the catalogue shot they sit under.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const OUTPUT_DIR = join(HERE, '../../../client/public/media/reviews');
const PUBLIC_PATH = '/media/reviews';

/** Desk surfaces rather than armour greys, so a build photo never reads as a catalogue plate. */
const SURFACES = ['#2b303a', '#343a45', '#232830', '#3d434f'] as const;

/** The built kit itself, lit against the desk. */
const BUILDS = ['#c9cfd8', '#a9b2c0', '#dde1e7', '#8d97a8'] as const;

/** A painted accent panel, so two photos of the same kit are not the same photo. */
const ACCENTS = ['#1f44a6', '#d6273c', '#1e8e5a', '#b4630f'] as const;

/** 4:3, the shape a phone camera actually produces. */
const WIDTH = 1200;
const HEIGHT = 900;

/**
 * Unsigned throughout. `hash` returns up to 2^32, and JavaScript's `>>` coerces to a *signed*
 * 32-bit int — so half of all seeds shift negative, `% length` then returns a negative index,
 * and the lookup yields `undefined`. That reaches the SVG as `fill="undefined"`, which paints
 * black: a build photo of a silhouette on a dark desk. `>>>` is the whole fix.
 */
function hash(value: string): number {
  return parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16);
}

export interface ReviewPhotoInput {
  /** The reviewed product, so a build photo at least belongs to the right kit. */
  slug: string;
  /** Which review of that product this is. */
  reviewIndex: number;
  /** Distinguishes the shots attached to one review. */
  index: number;
}

function svg({ slug, reviewIndex, index }: ReviewPhotoInput): string {
  const seed = hash(`${slug}:${reviewIndex}:${index}`);
  const surface = SURFACES[seed % SURFACES.length];
  const build = BUILDS[(seed >>> 3) % BUILDS.length];
  const accent = ACCENTS[(seed >>> 6) % ACCENTS.length];

  // The subject sits slightly off-centre, the way a handheld shot does.
  const cx = WIDTH / 2 + ((seed >>> 9) % 120) - 60;
  const torsoW = 200 + ((seed >>> 11) % 5) * 26;
  const torsoH = 300 + ((seed >>> 13) % 5) * 30;
  const top = HEIGHT - 140 - torsoH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${surface}"/>
  <ellipse cx="${cx}" cy="${HEIGHT - 120}" rx="${torsoW}" ry="46" fill="#000000" opacity="0.28"/>
  <rect x="${cx - torsoW / 2}" y="${top}" width="${torsoW}" height="${torsoH}" rx="10" fill="${build}"/>
  <rect x="${cx - torsoW / 2}" y="${top + torsoH * 0.42}" width="${torsoW}" height="14" fill="${accent}"/>
  <rect x="${cx - torsoW / 2 - 54}" y="${top + 60}" width="46" height="${torsoH * 0.55}" rx="8" fill="${build}" opacity="0.9"/>
  <rect x="${cx + torsoW / 2 + 8}" y="${top + 60}" width="46" height="${torsoH * 0.55}" rx="8" fill="${build}" opacity="0.9"/>
  <rect x="${cx - 46}" y="${top - 66}" width="92" height="66" rx="8" fill="${build}"/>
  <rect x="${cx - 30}" y="${top - 46}" width="60" height="10" fill="${accent}"/>
  <rect x="0" y="${HEIGHT - 92}" width="${WIDTH}" height="92" fill="#000000" opacity="0.18"/>
</svg>`;
}

/**
 * Removes the review photos of products that no longer exist.
 *
 * Scoped by product slug, like `prunePlaceholders`. A product that keeps its slug but gets
 * fewer photographed reviews can strand a few old files; they are small, gitignored and never
 * referenced, and removing them would mean deleting files another database may still render.
 */
export async function pruneReviewPhotos(liveSlugs: Iterable<string>): Promise<number> {
  return pruneOrphans(OUTPUT_DIR, liveSlugs);
}

export async function writeReviewPhoto(input: ReviewPhotoInput): Promise<string> {
  const filename = `${input.slug}-r${input.reviewIndex}-${input.index}.svg`;

  await writeFile(join(OUTPUT_DIR, filename), svg(input), 'utf8');

  return `${PUBLIC_PATH}/${filename}`;
}
