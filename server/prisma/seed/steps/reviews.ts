import { randomUUID } from 'node:crypto';
import { prisma } from '../client.ts';
import {
  KIT_REVIEW_TONES,
  REVIEW_AUTHORS,
  REVIEW_TOOLS_USED,
  TOOL_REVIEW_TONES,
  type ReviewTone,
} from '../data/reviews.ts';
import { randomFor } from '../random.ts';
import { clearReviewPhotos, writeReviewPhoto } from '../review-photo-placeholder.ts';

/**
 * Reviews, and the two counters on `product` that are derived from them.
 *
 * The product card prints `★ 4.8 (142)` (DESIGN.md §3.4) and one of the six sorts orders by
 * rating (FR-CAT-06), so a catalogue with no reviews cannot exercise either — nor the rating
 * filter, the histogram, or the "no reviews yet" state.
 *
 * Most are `APPROVED`, and **a handful are left `PENDING`** so the moderation queue (FR-ADM-11)
 * has something in it. A back office whose queue is empty on a fresh seed cannot be demonstrated
 * or tested, and the pending ones are excluded from the counters for the same reason the
 * application excludes them: only approved reviews are visible, so only approved reviews count.
 *
 * None is a verified purchase: the seeded orders are not tied to these rows, and claiming a
 * verified badge without an order line behind it would make the badge a decoration rather than
 * the fact FR-REV-02 defines it as. Phase 10 wires the real invite flow.
 *
 * `reviewCount` and `ratingAverageTenths` are written here rather than left at zero because
 * they are denormalised counters, and a seed that inserts reviews without updating them would
 * leave the database in a state the application can never produce.
 */

interface ReviewSeedProduct {
  id: string;
  slug: string;
  name: string;
  type: 'MODEL_KIT' | 'TOOL_SUPPLY';
  runtimeMinutesEst: number | null;
}

export interface ReviewResult {
  reviews: number;
  reviewedProducts: number;
  /** Left awaiting moderation, so the Phase 9 queue is never empty on a fresh seed. */
  pending: number;
  /** Approved reviews carrying at least one photo, which is what FR-REV-05's filter counts. */
  withPhotos: number;
  photos: number;
}

/** Roughly one product in six has none, so the empty state is reachable from the storefront. */
const UNREVIEWED_CHANCE = 1 / 6;

/**
 * How often a review is left awaiting moderation (FR-ADM-11).
 *
 * Low, because a queue holding a tenth of every review is a shop with a moderation problem
 * rather than a shop with a moderation screen — but non-zero on every reseed, which is what the
 * admin queue and its integration tests need.
 */
const PENDING_CHANCE = 1 / 12;

/**
 * How often an approved kit review comes with build photos (FR-REV-01, FR-REV-05).
 *
 * A quarter: high enough that the photos-only filter has a populated result on most products
 * rather than an empty state pretending to be a filter, low enough that the unfiltered list is
 * still mostly text and the filter therefore still removes something.
 *
 * Kits only. The placeholder is a built mobile suit on a desk, and attaching one to a review of
 * a bottle of cement would be a picture of the wrong thing.
 */
const PHOTO_CHANCE = 1 / 4;

export async function seedReviews(): Promise<ReviewResult> {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, type: true, runtimeMinutesEst: true },
    orderBy: { slug: 'asc' },
  });

  await clearReviewPhotos();

  let reviews = 0;
  let reviewedProducts = 0;
  let pending = 0;
  let withPhotos = 0;
  let photos = 0;

  for (const product of products) {
    const written = await createReviewsFor(product);

    reviews += written.approved + written.pending;
    pending += written.pending;
    withPhotos += written.withPhotos;
    photos += written.photos;
    if (written.approved > 0) reviewedProducts += 1;
  }

  return { reviews, reviewedProducts, pending, withPhotos, photos };
}

async function createReviewsFor(
  product: ReviewSeedProduct,
): Promise<{ approved: number; pending: number; withPhotos: number; photos: number }> {
  const random = randomFor(`reviews:${product.slug}`);

  /**
   * Photos draw from their own stream rather than from `random`.
   *
   * Sharing it would mean every draw made here shifted the ratings and moderation states of
   * the reviews after it — the same reason the file keys each product's stream off its slug.
   * A separate stream keeps this feature additive: the shop's ratings are the numbers they
   * were before photos existed.
   */
  const photoRandom = randomFor(`review-photos:${product.slug}`);

  if (random.chance(UNREVIEWED_CHANCE)) {
    return { approved: 0, pending: 0, withPhotos: 0, photos: 0 };
  }

  const tones = product.type === 'MODEL_KIT' ? KIT_REVIEW_TONES : TOOL_REVIEW_TONES;
  const count = random.int(3, 26);
  const ratings: number[] = [];
  let pending = 0;
  let withPhotos = 0;
  let photos = 0;

  for (let index = 0; index < count; index += 1) {
    const tone = pickTone(tones, random.next());
    const rating = random.pick(tone.ratings);
    const isPending = random.chance(PENDING_CHANCE);
    const createdAt = reviewDate(random);

    // Only approved reviews get photos: a pending one has not been looked at, and the
    // photos-only filter counts approved rows, so a pending review with photos would inflate
    // nothing and demonstrate nothing.
    const photoCount =
      product.type === 'MODEL_KIT' && !isPending && photoRandom.chance(PHOTO_CHANCE)
        ? photoRandom.int(1, 3)
        : 0;

    await prisma.review.create({
      data: {
        productId: product.id,
        // A review belongs to a session even when it belongs to no account (PRD §11.1). These
        // are synthetic sessions that will never be seen again, which is also true of a real
        // guest who never comes back.
        sessionId: randomUUID(),
        authorName: random.pick(REVIEW_AUTHORS),
        rating,
        title: random.pick(tone.titles),
        body: random.pick(tone.bodies),
        status: isPending ? 'PENDING' : 'APPROVED',
        // Null while pending: nobody has looked at it yet, and a moderation date on an
        // unmoderated review is a lie the queue would then have to explain.
        moderatedAt: isPending ? null : createdAt,
        isVerifiedPurchase: false,
        ...kitFields(product, rating, random),
        createdAt,
        photos: { create: await buildPhotos(product, index, photoCount) },
      },
    });

    if (photoCount > 0) {
      withPhotos += 1;
      photos += photoCount;
    }

    if (isPending) pending += 1;
    else ratings.push(rating);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      // Approved only — the same rule `ratingAggregate` applies when a review is moderated.
      reviewCount: ratings.length,
      ratingAverageTenths: ratings.length === 0 ? 0 : averageTenths(ratings),
    },
  });

  return { approved: ratings.length, pending, withPhotos, photos };
}

/**
 * Writes the files and returns the rows to nest under the review.
 *
 * The alt text describes the build rather than saying "review photo" (DESIGN.md §6) — a
 * screen reader gets what a sighted reader gets, which is somebody's finished kit.
 */
async function buildPhotos(
  product: ReviewSeedProduct,
  reviewIndex: number,
  count: number,
): Promise<{ url: string; alt: string; position: number }[]> {
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    rows.push({
      url: await writeReviewPhoto({ slug: product.slug, reviewIndex, index }),
      alt: `A builder's finished ${product.name}, photographed on a desk`,
      position: index * 10,
    });
  }

  return rows;
}

/**
 * Weighted so most reviews are positive, which is what a real catalogue looks like — an even
 * spread would make every product average 3.5 and the rating sort meaningless.
 */
function pickTone(tones: readonly ReviewTone[], roll: number): ReviewTone {
  const weights = [0.5, 0.28, 0.14, 0.08];
  let cumulative = 0;

  for (let index = 0; index < tones.length; index += 1) {
    cumulative += weights[index] ?? 0;
    if (roll < cumulative) return tones[index];
  }

  return tones[tones.length - 1];
}

/** FR-REV-04: build time, experienced difficulty and tools used are only asked about kits. */
function kitFields(
  product: ReviewSeedProduct,
  rating: number,
  random: ReturnType<typeof randomFor>,
): { buildTimeMinutes?: number; experiencedDifficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'; toolsUsed?: string[] } {
  if (product.type !== 'MODEL_KIT' || product.runtimeMinutesEst === null) {
    return {};
  }

  // Builders are slower than the box estimate more often than they are faster, and someone who
  // struggled is likelier to have rated it lower — which is what makes the field worth showing.
  const spread = rating >= 4 ? random.int(-15, 40) : random.int(10, 80);

  return {
    buildTimeMinutes: Math.max(30, Math.round((product.runtimeMinutesEst * (100 + spread)) / 100)),
    experiencedDifficulty: random.pick(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const),
    toolsUsed: uniquePicks(REVIEW_TOOLS_USED, random.int(1, 3), random),
  };
}

function uniquePicks(items: readonly string[], count: number, random: ReturnType<typeof randomFor>): string[] {
  const picked = new Set<string>();

  // Bounded: `count` is at most 3 against a pool of eight, so this cannot spin.
  while (picked.size < count) {
    picked.add(random.pick(items));
  }

  return [...picked];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Spread over the last year so the newest-first review sort has something to order by. */
function reviewDate(random: ReturnType<typeof randomFor>): Date {
  return new Date(Date.now() - random.int(1, 365) * DAY_MS);
}

/** 4.75 becomes 48 — tenths of a star, matching `product.rating_average_tenths`. */
function averageTenths(ratings: readonly number[]): number {
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return Math.round((total * 10) / ratings.length);
}
