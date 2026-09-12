import { prisma } from './client.ts';
import { resetTables } from './steps/reset.ts';
import { seedReference } from './steps/reference.ts';
import { seedRegions } from './steps/regions.ts';
import { seedCatalogue } from './steps/catalogue.ts';
import { seedRequirements } from './steps/requirements.ts';
import { seedCommerce } from './steps/commerce.ts';
import { seedReviews } from './steps/reviews.ts';
import { seedHistory } from './steps/history.ts';

/**
 * Seeds a complete, browsable shop.
 *
 * Deliberately not a handful of rows: the storefront cannot be judged — or its performance
 * measured, or its empty states found — against three products. The catalogue here spans every
 * grade, both product types, multi-variant and single-variant products, and a spread of stock
 * states including genuinely out-of-stock and low-stock lines, because those are the states
 * that get skipped when data is invented by hand during a feature.
 *
 * Ordering matters twice: tools exist before kits, so kit requirements can point at them; and
 * reviews are written before trading history, which derives sold counts from review counts.
 * Everything else is independent.
 */
async function main(): Promise<void> {
  const started = Date.now();
  console.log('Seeding GunSnip…\n');

  await resetTables();
  console.log('  reset       every table truncated');

  const refs = await seedReference();
  console.log(
    `  reference   ${refs.gradeIdByCode.size} grades · ${refs.scaleIdByCode.size} scales · ` +
      `${refs.seriesIdBySlug.size} series · ${refs.brandIdBySlug.size} brands · ` +
      `${refs.categoryIdBySlug.size} categories`,
  );

  const regions = await seedRegions();
  console.log(`  regions     ${regions} provinces, cities and districts`);

  const catalogue = await seedCatalogue(refs);
  console.log(
    `  catalogue   ${catalogue.productCount} products · ${catalogue.variantCount} variants · ` +
      `${catalogue.imageCount} images`,
  );

  const requirements = await seedRequirements(refs, catalogue.productIdBySlug);
  console.log(
    `  build reqs  ${requirements.defaults} grade defaults · ${requirements.requirements} kit requirements`,
  );

  const commerce = await seedCommerce(refs, catalogue.variantIdBySku);
  console.log(
    `  commerce    ${commerce.vouchers} vouchers · ${commerce.bundles} bundles · ${commerce.banners} banners`,
  );

  // Reviews before history: sold counts are derived from review counts, so the aggregate has
  // to be written before anything reads it.
  const reviews = await seedReviews();
  console.log(
    `  reviews     ${reviews.reviews} across ${reviews.reviewedProducts} products ` +
      `(${reviews.pending} awaiting moderation)`,
  );

  const history = await seedHistory();
  console.log(
    `  history     ${history.productsWithSales} products with sales · ${history.restocks} recent restocks`,
  );

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
