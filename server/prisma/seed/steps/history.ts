import { prisma } from '../client.ts';
import { randomFor } from '../random.ts';

/**
 * The trading history the shop is presented as already having: how much of each product has
 * sold, and which variants came back into stock recently.
 *
 * Both exist because a home page and a listing page cannot be built against a catalogue that
 * has never sold anything — FR-CAT-01's "back in stock" rail would be permanently empty and
 * FR-CAT-06's `best_selling` sort would tie every row. Neither is invented for decoration:
 *
 *   `product.units_sold`   Phase 7 increments this on fulfilment. Seeded here so the sort and
 *                          the "1.2k sold" line on the card have something true-shaped to show.
 *   `inventory_movement`   A RESTOCK row is exactly what the Phase 9 admin stock adjustment
 *                          writes. The rail reads movements rather than a `restocked_at`
 *                          column so there is one source of truth for stock history.
 *
 * No `order` rows are created — orders are Phase 7, and a half-built order would be worse than
 * none. That does mean `units_sold` is not reconcilable against order lines until then, which
 * is the one seam this file knowingly leaves open.
 */

export interface HistoryResult {
  productsWithSales: number;
  restocks: number;
}

/** Restocked within this window counts as "back in stock" on the home page. */
const RESTOCK_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Enough to fill the rail twice over, so it still has content after filtering out sold-out ones. */
const RESTOCK_COUNT = 12;

export async function seedHistory(): Promise<HistoryResult> {
  const productsWithSales = await seedUnitsSold();
  const restocks = await seedRestocks();

  return { productsWithSales, restocks };
}

/**
 * Sales are long-tailed: a few products carry most of the volume and plenty have sold single
 * digits. A uniform spread would make the best-selling sort look arbitrary, because the top of
 * the list would be indistinguishable from the middle.
 */
async function seedUnitsSold(): Promise<number> {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, reviewCount: true },
    orderBy: { slug: 'asc' },
  });

  let withSales = 0;

  for (const product of products) {
    const random = randomFor(`sales:${product.slug}`);

    // Reviews are the one honest predictor available here: a product nobody bought would not
    // have twenty reviews, so tying the two keeps the card's "★ 4.8 (142) · 1.2k sold" line
    // internally consistent rather than pairing a hit rating with three units sold.
    const floor = product.reviewCount * random.int(8, 30);
    // The volume bonus is gated on having reviews: a product that shifted two thousand units
    // and collected no feedback at all is the one combination this data should not produce,
    // because it puts a top-of-the-sort card on screen with an empty rating line.
    const unitsSold =
      product.reviewCount > 0 && random.chance(0.15)
        ? floor + random.int(400, 2600) // the handful of products that actually carry the shop
        : floor + random.int(0, 120);

    if (unitsSold === 0) continue;

    await prisma.product.update({ where: { id: product.id }, data: { unitsSold } });
    withSales += 1;
  }

  return withSales;
}

/**
 * Picks in-stock variants and back-dates a RESTOCK movement for each. Only in-stock ones: a
 * "back in stock" rail that links to something out of stock is worse than an empty rail.
 */
async function seedRestocks(): Promise<number> {
  const variants = await prisma.productVariant.findMany({
    where: { isArchived: false },
    select: { id: true, sku: true, stockOnHand: true, stockReserved: true, product: { select: { slug: true } } },
    orderBy: { sku: 'asc' },
  });

  const available = variants.filter((variant) => variant.stockOnHand - variant.stockReserved > 0);

  // Deterministic spread across the catalogue rather than the first twelve alphabetically,
  // which would put every restock on the same two products.
  const random = randomFor('restocks');
  const chosen = shuffle(available, random).slice(0, RESTOCK_COUNT);

  for (const variant of chosen) {
    const daysAgo = random.int(1, RESTOCK_WINDOW_DAYS - 2);

    await prisma.inventoryMovement.create({
      data: {
        variantId: variant.id,
        // The quantity that arrived, not the quantity now on hand — a movement is a delta.
        delta: random.int(4, 40),
        reason: 'RESTOCK',
        note: 'Opening stock received',
        // Seeded rows have no operator behind them, which `SYSTEM` is the honest label for.
        actorKind: 'SYSTEM',
        createdAt: new Date(Date.now() - daysAgo * DAY_MS),
      },
    });
  }

  return chosen.length;
}

/** Fisher–Yates against the seeded generator, so the same twelve are chosen every reset. */
function shuffle<T>(items: readonly T[], random: ReturnType<typeof randomFor>): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = random.int(0, index);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }

  return copy;
}
