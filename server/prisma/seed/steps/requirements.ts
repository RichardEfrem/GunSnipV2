import { prisma } from '../client.ts';
import { KITS } from '../data/kits.ts';
import {
  GRADE_TOOL_DEFAULTS,
  STAND_REQUIREMENT,
  STAND_REQUIRED_SLUGS,
  WATERSLIDE_REQUIREMENT,
} from '../data/commerce.ts';
import type { ReferenceIds } from './reference.ts';

/**
 * "What you'll need to build this" (FR-PDP-08), assembled the way the operator would.
 *
 * Two layers, exactly as PRD §5.3 describes: a per-grade default, then per-kit overrides for
 * the things that are a property of the individual kit rather than its grade. The grade
 * defaults are also stored in `grade_tool_default`, so the admin build-requirement editor
 * (FR-ADM-06) has something to offer as a starting point for a newly created kit.
 */
export async function seedRequirements(
  refs: ReferenceIds,
  productIdBySlug: Map<string, string>,
): Promise<{ defaults: number; requirements: number }> {
  // 1. The per-grade defaults, as reusable reference data.
  for (const entry of GRADE_TOOL_DEFAULTS) {
    await prisma.gradeToolDefault.create({
      data: {
        gradeId: required(refs.gradeIdByCode, entry.gradeCode, 'grade'),
        toolProductId: required(productIdBySlug, entry.toolSlug, 'tool'),
        necessity: entry.necessity,
        reason: entry.reason ?? null,
        position: entry.position,
      },
    });
  }

  const defaultsByGrade = new Map<string, typeof GRADE_TOOL_DEFAULTS>();
  for (const entry of GRADE_TOOL_DEFAULTS) {
    defaultsByGrade.set(entry.gradeCode, [...(defaultsByGrade.get(entry.gradeCode) ?? []), entry]);
  }

  // 2. Copy them onto each kit, then layer the kit-specific ones on top.
  let requirements = 0;

  for (const kit of KITS) {
    const kitProductId = required(productIdBySlug, kit.slug, 'kit');
    const rows = new Map<string, { necessity: string; reason: string | null; position: number }>();

    for (const entry of defaultsByGrade.get(kit.gradeCode) ?? []) {
      rows.set(entry.toolSlug, {
        necessity: entry.necessity,
        reason: entry.reason ?? null,
        position: entry.position,
      });
    }

    // Waterslide decals are a property of the kit, not the grade — an RG and an MG both need
    // setting solution, an HG with foil stickers does not.
    if (kit.decalType === 'WATERSLIDE') {
      rows.set(WATERSLIDE_REQUIREMENT.toolSlug, {
        necessity: WATERSLIDE_REQUIREMENT.necessity,
        reason: WATERSLIDE_REQUIREMENT.reason,
        position: WATERSLIDE_REQUIREMENT.position,
      });
    }

    if (STAND_REQUIRED_SLUGS.includes(kit.slug)) {
      rows.set(STAND_REQUIREMENT.toolSlug, {
        necessity: STAND_REQUIREMENT.necessity,
        reason: STAND_REQUIREMENT.reason,
        position: STAND_REQUIREMENT.position,
      });
    }

    for (const [toolSlug, row] of rows) {
      await prisma.productRequirement.create({
        data: {
          kitProductId,
          toolProductId: required(productIdBySlug, toolSlug, 'tool'),
          necessity: row.necessity as 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL',
          reason: row.reason,
          position: row.position,
        },
      });
      requirements += 1;
    }
  }

  return { defaults: GRADE_TOOL_DEFAULTS.length, requirements };
}

function required(source: Map<string, string>, key: string, what: string): string {
  const id = source.get(key);
  if (id === undefined) throw new Error(`Seed refers to unknown ${what} "${key}"`);
  return id;
}
