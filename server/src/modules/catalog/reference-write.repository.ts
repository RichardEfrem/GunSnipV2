import { Injectable } from '@nestjs/common';
import type { ProductType } from '@gunsnip/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminCategory, AdminReferenceItem } from './entities/admin-reference.entity.js';

/**
 * All Prisma access for reference-data writes (FR-ADM-09).
 *
 * `ReferenceRepository` reads the same five tables for the filter rail; this one writes them and
 * reads them with their usage counts. Separate because they answer different questions — the
 * rail needs `{ id, value, label }` and nothing else, and putting a `_count` on that query would
 * make every category page pay for a number only the back office reads.
 */
@Injectable()
export class ReferenceWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------------------ grades

  async grades(): Promise<AdminReferenceItem[]> {
    const rows = await this.prisma.grade.findMany({
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        position: true,
        _count: { select: { products: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      key: row.code,
      name: row.name,
      description: row.description,
      position: row.position,
      usageCount: row._count.products,
    }));
  }

  async createGrade(data: { code: string; name: string; description: string | null; position: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.grade.create({ data, select: { id: true, code: true, name: true, description: true, position: true } });
    return { ...toItem(row.id, row.code, row.name, row.position), description: row.description };
  }

  async updateGrade(id: string, data: { name?: string; description?: string | null; position?: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.grade.update({
      where: { id },
      data,
      select: { id: true, code: true, name: true, description: true, position: true, _count: { select: { products: true } } },
    });

    return { id: row.id, key: row.code, name: row.name, description: row.description, position: row.position, usageCount: row._count.products };
  }

  async deleteGrade(id: string): Promise<void> {
    await this.prisma.grade.delete({ where: { id } });
  }

  async gradeUsage(id: string): Promise<number> {
    return this.prisma.product.count({ where: { gradeId: id } });
  }

  async isGradeCodeTaken(code: string): Promise<boolean> {
    return (await this.prisma.grade.findUnique({ where: { code }, select: { id: true } })) !== null;
  }

  // ------------------------------------------------------------------------------ scales

  async scales(): Promise<AdminReferenceItem[]> {
    const rows = await this.prisma.scale.findMany({
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, position: true, _count: { select: { products: true } } },
    });

    return rows.map((row) => ({ ...toItem(row.id, row.code, row.name, row.position), usageCount: row._count.products }));
  }

  async createScale(data: { code: string; name: string; position: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.scale.create({ data, select: { id: true, code: true, name: true, position: true } });
    return toItem(row.id, row.code, row.name, row.position);
  }

  async updateScale(id: string, data: { name?: string; position?: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.scale.update({
      where: { id },
      data,
      select: { id: true, code: true, name: true, position: true, _count: { select: { products: true } } },
    });

    return { ...toItem(row.id, row.code, row.name, row.position), usageCount: row._count.products };
  }

  async deleteScale(id: string): Promise<void> {
    await this.prisma.scale.delete({ where: { id } });
  }

  async scaleUsage(id: string): Promise<number> {
    return this.prisma.product.count({ where: { scaleId: id } });
  }

  async isScaleCodeTaken(code: string): Promise<boolean> {
    return (await this.prisma.scale.findUnique({ where: { code }, select: { id: true } })) !== null;
  }

  // ------------------------------------------------------------------------------ series

  async series(): Promise<AdminReferenceItem[]> {
    const rows = await this.prisma.series.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, position: true, _count: { select: { products: true } } },
    });

    return rows.map((row) => ({ ...toItem(row.id, row.slug, row.name, row.position), usageCount: row._count.products }));
  }

  async createSeries(data: { name: string; slug: string; position: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.series.create({ data, select: { id: true, slug: true, name: true, position: true } });
    return toItem(row.id, row.slug, row.name, row.position);
  }

  async updateSeries(id: string, data: { name?: string; position?: number }): Promise<AdminReferenceItem> {
    const row = await this.prisma.series.update({
      where: { id },
      data,
      select: { id: true, slug: true, name: true, position: true, _count: { select: { products: true } } },
    });

    return { ...toItem(row.id, row.slug, row.name, row.position), usageCount: row._count.products };
  }

  async deleteSeries(id: string): Promise<void> {
    await this.prisma.series.delete({ where: { id } });
  }

  async seriesUsage(id: string): Promise<number> {
    return this.prisma.product.count({ where: { seriesId: id } });
  }

  async isSeriesSlugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.series.findUnique({ where: { slug }, select: { id: true } })) !== null;
  }

  // ------------------------------------------------------------------------------ brands

  async brands(): Promise<AdminReferenceItem[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, _count: { select: { products: true } } },
    });

    return rows.map((row) => ({ ...toItem(row.id, row.slug, row.name, 0), usageCount: row._count.products }));
  }

  async createBrand(data: { name: string; slug: string }): Promise<AdminReferenceItem> {
    const row = await this.prisma.brand.create({ data, select: { id: true, slug: true, name: true } });
    return toItem(row.id, row.slug, row.name, 0);
  }

  async updateBrand(id: string, data: { name?: string }): Promise<AdminReferenceItem> {
    const row = await this.prisma.brand.update({
      where: { id },
      data,
      select: { id: true, slug: true, name: true, _count: { select: { products: true } } },
    });

    return { ...toItem(row.id, row.slug, row.name, 0), usageCount: row._count.products };
  }

  async deleteBrand(id: string): Promise<void> {
    await this.prisma.brand.delete({ where: { id } });
  }

  async brandUsage(id: string): Promise<number> {
    return this.prisma.product.count({ where: { brandId: id } });
  }

  async isBrandSlugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.brand.findUnique({ where: { slug }, select: { id: true } })) !== null;
  }

  // -------------------------------------------------------------------------- categories

  /**
   * The whole tree, flattened depth-first with each row's depth, so the screen can indent
   * without walking the tree itself. Small enough to read whole — there are tens of categories,
   * not thousands, and a recursive CTE for a list this size is machinery nobody needs.
   */
  async categories(): Promise<AdminCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ type: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        parentId: true,
        position: true,
        _count: { select: { products: true } },
      },
    });

    const byParent = new Map<string | null, typeof rows>();
    for (const row of rows) {
      byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row]);
    }

    const flattened: AdminCategory[] = [];

    const walk = (parentId: string | null, depth: number): void => {
      for (const row of byParent.get(parentId) ?? []) {
        flattened.push({
          id: row.id,
          name: row.name,
          slug: row.slug,
          type: row.type,
          parentId: row.parentId,
          position: row.position,
          usageCount: row._count.products,
          depth,
        });
        walk(row.id, depth + 1);
      }
    };

    walk(null, 0);

    return flattened;
  }

  async findCategory(id: string): Promise<{ id: string; type: ProductType; parentId: string | null } | null> {
    return this.prisma.category.findUnique({ where: { id }, select: { id: true, type: true, parentId: true } });
  }

  async createCategory(data: {
    name: string;
    slug: string;
    type: ProductType;
    parentId: string | null;
    position: number;
  }): Promise<AdminCategory> {
    const row = await this.prisma.category.create({
      data,
      select: { id: true, name: true, slug: true, type: true, parentId: true, position: true },
    });

    return { ...row, usageCount: 0, depth: await this.depthOf(row.parentId) };
  }

  async updateCategory(
    id: string,
    data: { name?: string; parentId?: string | null; position?: number },
  ): Promise<AdminCategory> {
    const row = await this.prisma.category.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        parentId: true,
        position: true,
        _count: { select: { products: true } },
      },
    });

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      parentId: row.parentId,
      position: row.position,
      usageCount: row._count.products,
      depth: await this.depthOf(row.parentId),
    };
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async categoryUsage(id: string): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: id } });
  }

  async categoryChildCount(id: string): Promise<number> {
    return this.prisma.category.count({ where: { parentId: id } });
  }

  /** Everything beneath a category, for the cycle check when a parent is reassigned. */
  async categoryDescendantIds(id: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });

    const descendants: string[] = [];
    let frontier = [id];

    while (frontier.length > 0) {
      const next = all.filter((row) => row.parentId !== null && frontier.includes(row.parentId)).map((row) => row.id);
      descendants.push(...next);
      frontier = next;
    }

    return descendants;
  }

  /** One generic existence check, so the service does not need five near-identical ones. */
  async exists(table: string, id: string): Promise<boolean> {
    switch (table) {
      case 'grade':
        return (await this.prisma.grade.findUnique({ where: { id }, select: { id: true } })) !== null;
      case 'scale':
        return (await this.prisma.scale.findUnique({ where: { id }, select: { id: true } })) !== null;
      case 'series':
        return (await this.prisma.series.findUnique({ where: { id }, select: { id: true } })) !== null;
      case 'brand':
        return (await this.prisma.brand.findUnique({ where: { id }, select: { id: true } })) !== null;
      case 'category':
        return (await this.prisma.category.findUnique({ where: { id }, select: { id: true } })) !== null;
      default:
        throw new Error(`Unknown reference table "${table}".`);
    }
  }

  async isCategorySlugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.category.findUnique({ where: { slug }, select: { id: true } })) !== null;
  }

  private async depthOf(parentId: string | null): Promise<number> {
    let depth = 0;
    let current = parentId;

    // Bounded by the same guard the service enforces — a tree with a cycle cannot be written, so
    // this cannot spin. The limit is belt and braces against a row written outside the service.
    while (current !== null && depth < 20) {
      const parent = await this.prisma.category.findUnique({ where: { id: current }, select: { parentId: true } });
      if (parent === null) break;

      current = parent.parentId;
      depth += 1;
    }

    return depth;
  }
}

function toItem(id: string, key: string, name: string, position: number): AdminReferenceItem {
  return { id, key, name, description: null, position, usageCount: 0 };
}
