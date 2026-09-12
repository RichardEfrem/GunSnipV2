import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Region } from './entities/region.entity.js';
import type { ShippingDestination } from './entities/shipping-destination.entity.js';

/**
 * The most children one region may list.
 *
 * Far above any real parent — the largest Indonesian province has under forty regencies and
 * cities, the largest city under fifty districts — so it never truncates real data. It is the
 * hard cap CLAUDE.md requires on a list; see `ListRegionsDto` for why this list has no cursor.
 */
export const MAX_REGIONS_PER_PARENT = 200;

/** A region and the two levels above it — the whole tree is three deep (FR-CO-03). */
const ANCESTRY_SELECT = {
  id: true,
  level: true,
  name: true,
  postalCode: true,
  shippingZone: true,
  _count: { select: { children: true } },
  parent: {
    select: {
      level: true,
      name: true,
      postalCode: true,
      shippingZone: true,
      parent: { select: { level: true, name: true, shippingZone: true } },
    },
  },
} satisfies Prisma.AddressRegionSelect;

type AncestryRow = Prisma.AddressRegionGetPayload<{ select: typeof ANCESTRY_SELECT }>;

/** All Prisma access for the address region tree (CLAUDE.md). */
@Injectable()
export class RegionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Provinces when `parentId` is null; otherwise one region's direct children. By name. */
  async children(parentId: string | null): Promise<Region[]> {
    const rows = await this.prisma.addressRegion.findMany({
      where: { parentId },
      select: {
        id: true,
        name: true,
        level: true,
        postalCode: true,
        _count: { select: { children: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: MAX_REGIONS_PER_PARENT,
    });

    return rows.map(({ _count, ...region }) => ({ ...region, hasChildren: _count.children > 0 }));
  }

  async findDestination(regionId: string): Promise<ShippingDestination | null> {
    const row = await this.prisma.addressRegion.findUnique({ where: { id: regionId }, select: ANCESTRY_SELECT });
    return row === null ? null : toDestination(row);
  }
}

/** Reads the chain from the most specific level up, whichever level the region is. */
function toDestination(row: AncestryRow): ShippingDestination {
  const chain = [row, row.parent, row.parent?.parent].filter(
    (link): link is NonNullable<typeof link> => link !== null && link !== undefined,
  );
  const nameAt = (level: string) => chain.find((link) => link.level === level)?.name ?? null;

  return {
    regionId: row.id,
    level: row.level,
    // Every chain ends at a province: the tree is seeded top-down and `parent_id` is RESTRICT.
    province: nameAt('PROVINCE') ?? row.name,
    city: nameAt('CITY'),
    district: nameAt('DISTRICT'),
    postalCode: row.postalCode ?? row.parent?.postalCode ?? null,
    zone: chain.find((link) => link.shippingZone !== null)?.shippingZone ?? null,
    isLeaf: row._count.children === 0,
  };
}
