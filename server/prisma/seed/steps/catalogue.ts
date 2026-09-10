import { clearPlaceholders, writePlaceholder } from '../image-placeholder.ts';
import { prisma } from '../client.ts';
import { KITS } from '../data/kits.ts';
import { TOOLS } from '../data/tools.ts';
import type { VariantSeed } from '../data/tools.ts';
import type { ReferenceIds } from './reference.ts';

/**
 * The catalogue: products, their variants and their imagery.
 *
 * Published rather than draft, and back-dated across the last few months so "new arrivals"
 * and the newest-first sort have something real to order by — a catalogue where every row
 * shares one timestamp cannot exercise either.
 */

/** Three shots per product, which is enough for the PDP gallery to be worth navigating. */
const IMAGES_PER_PRODUCT = 3;

export interface CatalogueResult {
  productIdBySlug: Map<string, string>;
  variantIdBySku: Map<string, string>;
  productCount: number;
  variantCount: number;
  imageCount: number;
}

export async function seedCatalogue(refs: ReferenceIds): Promise<CatalogueResult> {
  await clearPlaceholders();

  const productIdBySlug = new Map<string, string>();
  const variantIdBySku = new Map<string, string>();
  let variantCount = 0;
  let imageCount = 0;

  // Tools first: kit requirements point at them, and seeding them here means the requirement
  // step never has to care about ordering.
  let index = 0;

  for (const tool of TOOLS) {
    const product = await prisma.product.create({
      data: {
        type: 'TOOL_SUPPLY',
        status: 'PUBLISHED',
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        brandId: required(refs.brandIdBySlug, tool.brandSlug, 'brand'),
        categoryId: required(refs.categoryIdBySlug, tool.categorySlug, 'category'),
        toolJob: tool.job,
        attributes: tool.attributes,
        tags: [...tool.tags],
        publishedAt: publishedAt(index),
      },
    });

    productIdBySlug.set(tool.slug, product.id);
    variantCount += await createVariants(product.id, tool.variants, variantIdBySku);
    imageCount += await createImages(product.id, tool.slug, 'TOOL', tool.variants[0].sku, tool.name);
    index += 1;
  }

  for (const kit of KITS) {
    const product = await prisma.product.create({
      data: {
        type: 'MODEL_KIT',
        status: 'PUBLISHED',
        name: kit.name,
        slug: kit.slug,
        description: kit.description,
        brandId: required(refs.brandIdBySlug, 'bandai-spirits', 'brand'),
        categoryId: required(refs.categoryIdBySlug, kit.categorySlug, 'category'),
        gradeId: required(refs.gradeIdByCode, kit.gradeCode, 'grade'),
        scaleId: required(refs.scaleIdByCode, kit.scaleCode, 'scale'),
        seriesId: required(refs.seriesIdBySlug, kit.seriesSlug, 'series'),
        unitName: kit.unitName,
        unitCode: kit.unitCode,
        runnerCount: kit.runnerCount,
        partCount: kit.partCount,
        difficulty: kit.difficulty,
        decalType: kit.decalType,
        articulationNotes: kit.articulationNotes,
        includes: [...kit.includes],
        releaseYear: kit.releaseYear,
        runtimeMinutesEst: kit.runtimeMinutesEst,
        tags: [...kit.tags],
        publishedAt: publishedAt(index),
      },
    });

    productIdBySlug.set(kit.slug, product.id);
    variantCount += await createVariants(product.id, kit.variants, variantIdBySku);
    imageCount += await createImages(product.id, kit.slug, kit.gradeCode, kit.unitCode, kit.name);
    index += 1;
  }

  return {
    productIdBySlug,
    variantIdBySku,
    productCount: productIdBySlug.size,
    variantCount,
    imageCount,
  };
}

/** Spread over roughly the last six months, newest last. */
function publishedAt(index: number): Date {
  const daysAgo = 180 - index * 2;
  return new Date(Date.now() - Math.max(1, daysAgo) * 24 * 60 * 60 * 1000);
}

/**
 * Creates a product's variants and writes the denormalised price range back onto it.
 *
 * The write-back is not an optimisation: `product.min_price_idr` is what the price sort and
 * the price-range filter read (FR-CAT-04, FR-CAT-06), so a variant inserted without it leaves
 * a product that sorts as if it were free. Every future writer of a variant price owes the
 * same update — the admin variant editor in Phase 9 is the next one.
 */
async function createVariants(
  productId: string,
  variants: readonly VariantSeed[],
  into: Map<string, string>,
): Promise<number> {
  let position = 0;

  for (const variant of variants) {
    const created = await prisma.productVariant.create({
      data: {
        productId,
        sku: variant.sku,
        name: variant.name ?? null,
        optionValues: variant.optionValues ?? {},
        priceIdr: variant.priceIdr,
        compareAtPriceIdr: variant.compareAtPriceIdr ?? null,
        stockOnHand: variant.stockOnHand,
        // Nothing is reserved in a fresh catalogue — reservations are created by orders.
        stockReserved: 0,
        weightGrams: variant.weightGrams,
        position,
      },
    });

    into.set(variant.sku, created.id);
    position += 10;
  }

  const prices = variants.map((variant) => variant.priceIdr);

  await prisma.product.update({
    where: { id: productId },
    data: { minPriceIdr: Math.min(...prices), maxPriceIdr: Math.max(...prices) },
  });

  return variants.length;
}

async function createImages(
  productId: string,
  slug: string,
  mark: string,
  code: string,
  productName: string,
): Promise<number> {
  for (let index = 0; index < IMAGES_PER_PRODUCT; index += 1) {
    const { url, blurDataUrl } = await writePlaceholder({ slug, mark, code, index });

    await prisma.productImage.create({
      data: {
        productId,
        url,
        // Describes the product, never "product image" (DESIGN.md §6).
        alt: index === 0 ? productName : `${productName}, view ${index + 1}`,
        blurDataUrl,
        position: index * 10,
        isPrimary: index === 0,
      },
    });
  }

  return IMAGES_PER_PRODUCT;
}

/** A missing reference id is a broken seed, not something to paper over with a null. */
function required(source: Map<string, string>, key: string, what: string): string {
  const id = source.get(key);
  if (id === undefined) throw new Error(`Seed refers to unknown ${what} "${key}"`);
  return id;
}
