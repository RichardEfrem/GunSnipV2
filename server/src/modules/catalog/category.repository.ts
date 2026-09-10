import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** All Prisma access for the category aggregate. */

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  type: true,
  parentId: true,
  position: true,
  parent: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The whole tree in one query.
   *
   * It is eighteen rows of reference data that changes when an operator edits it, so fetching
   * all of it and assembling the tree in memory beats a recursive CTE or a query per level. If
   * this ever grows past a few hundred rows the shape of the answer changes, not this method.
   */
  async findAll(): Promise<CategoryRow[]> {
    return this.prisma.category.findMany({
      select: CATEGORY_SELECT,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async findBySlug(slug: string): Promise<CategoryRow | null> {
    return this.prisma.category.findUnique({ where: { slug }, select: CATEGORY_SELECT });
  }

  /** Published products per category id, for the counts beside each navigation entry. */
  async countProductsByCategory(): Promise<Map<string, number>> {
    const groups = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { status: 'PUBLISHED' },
      _count: { _all: true },
    });

    return new Map(groups.map((group) => [group.categoryId, group._count._all]));
  }
}
