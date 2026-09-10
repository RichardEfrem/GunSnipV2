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

/**
 * Approved reviews, and the two counters on `product` that are derived from them.
 *
 * The product card prints `★ 4.8 (142)` (DESIGN.md §3.4) and one of the six sorts orders by
 * rating (FR-CAT-06), so a catalogue with no reviews cannot exercise either — nor the rating
 * filter, the histogram, or the "no reviews yet" state.
 *
 * Every review here is `APPROVED` and **not** a verified purchase: no orders exist yet, and
 * claiming a verified badge without an order line behind it would make the badge a decoration
 * rather than the fact FR-REV-02 defines it as. Phase 10 wires the real invite flow, which is
 * what produces verified ones.
 *
 * `reviewCount` and `ratingAverageTenths` are written here rather than left at zero because
 * they are denormalised counters, and a seed that inserts reviews without updating them would
 * leave the database in a state the application can never produce.
 */

interface ReviewSeedProduct {
  id: string;
  slug: string;
  type: 'MODEL_KIT' | 'TOOL_SUPPLY';
  runtimeMinutesEst: number | null;
}

export interface ReviewResult {
  reviews: number;
  reviewedProducts: number;
}

/** Roughly one product in six has none, so the empty state is reachable from the storefront. */
const UNREVIEWED_CHANCE = 1 / 6;

export async function seedReviews(): Promise<ReviewResult> {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, type: true, runtimeMinutesEst: true },
    orderBy: { slug: 'asc' },
  });

  let reviews = 0;
  let reviewedProducts = 0;

  for (const product of products) {
    const written = await createReviewsFor(product);

    reviews += written;
    if (written > 0) reviewedProducts += 1;
  }

  return { reviews, reviewedProducts };
}

async function createReviewsFor(product: ReviewSeedProduct): Promise<number> {
  const random = randomFor(`reviews:${product.slug}`);

  if (random.chance(UNREVIEWED_CHANCE)) {
    return 0;
  }

  const tones = product.type === 'MODEL_KIT' ? KIT_REVIEW_TONES : TOOL_REVIEW_TONES;
  const count = random.int(3, 26);
  const ratings: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const tone = pickTone(tones, random.next());
    const rating = random.pick(tone.ratings);

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
        status: 'APPROVED',
        isVerifiedPurchase: false,
        ...kitFields(product, rating, random),
        createdAt: reviewDate(random),
      },
    });

    ratings.push(rating);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      reviewCount: ratings.length,
      ratingAverageTenths: averageTenths(ratings),
    },
  });

  return ratings.length;
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
