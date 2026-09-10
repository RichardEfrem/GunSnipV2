import { prisma } from '../client.ts';
import { BRANDS, CATEGORIES, GRADES, SCALES, SEARCH_SYNONYMS, SERIES, type CategorySeed } from '../data/reference.ts';
import { SHIPPING_RATES } from '../data/regions.ts';

export interface ReferenceIds {
  gradeIdByCode: Map<string, string>;
  scaleIdByCode: Map<string, string>;
  seriesIdBySlug: Map<string, string>;
  brandIdBySlug: Map<string, string>;
  categoryIdBySlug: Map<string, string>;
}

/** Reference tables plus the flat shipping rate card. Nothing here depends on anything else. */
export async function seedReference(): Promise<ReferenceIds> {
  const grades = await Promise.all(GRADES.map((grade) => prisma.grade.create({ data: grade })));
  const scales = await Promise.all(SCALES.map((scale) => prisma.scale.create({ data: scale })));
  const series = await Promise.all(SERIES.map((entry) => prisma.series.create({ data: entry })));
  const brands = await Promise.all(BRANDS.map((brand) => prisma.brand.create({ data: brand })));

  const categoryIdBySlug = new Map<string, string>();
  await createCategories(CATEGORIES, null, categoryIdBySlug);

  await prisma.searchSynonym.createMany({
    data: SEARCH_SYNONYMS.map(({ term, expansions }) => ({
      // Lower-cased on write so the lookup never has to think about it (FR-SRCH-04).
      term: term.toLowerCase(),
      expansions: expansions.map((value) => value.toLowerCase()),
    })),
  });

  await prisma.shippingRate.createMany({ data: SHIPPING_RATES.map((rate) => ({ ...rate })) });

  return {
    gradeIdByCode: new Map(grades.map((grade) => [grade.code, grade.id])),
    scaleIdByCode: new Map(scales.map((scale) => [scale.code, scale.id])),
    seriesIdBySlug: new Map(series.map((entry) => [entry.slug, entry.id])),
    brandIdBySlug: new Map(brands.map((brand) => [brand.slug, brand.id])),
    categoryIdBySlug,
  };
}

/** Depth-first, because a child needs its parent's generated id. */
async function createCategories(
  nodes: readonly CategorySeed[],
  parentId: string | null,
  into: Map<string, string>,
): Promise<void> {
  for (const node of nodes) {
    const created = await prisma.category.create({
      data: { name: node.name, slug: node.slug, type: node.type, position: node.position, parentId },
    });

    into.set(node.slug, created.id);

    if (node.children !== undefined) {
      await createCategories(node.children, created.id, into);
    }
  }
}
