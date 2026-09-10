import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * The operator-editable reference tables the filter rail is built from — grades, scales,
 * series and brands (FR-ADM-09).
 *
 * Separate from `CategoryRepository` because these are flat lists with no tree, and separate
 * from `ProductRepository` because they are their own aggregate: a grade exists whether or not
 * any product has it, which is exactly what makes a zero-count option possible (FR-CAT-10).
 */

/** One option in the rail: the id `groupBy` counts by, and the value a URL carries. */
export interface ReferenceOption {
  id: string;
  /** The stable code or slug that appears in the query string, never the id (FR-CAT-07). */
  value: string;
  label: string;
}

@Injectable()
export class ReferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async grades(): Promise<ReferenceOption[]> {
    const rows = await this.prisma.grade.findMany({
      select: { id: true, code: true, name: true },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });

    return rows.map((row) => ({ id: row.id, value: row.code, label: row.name }));
  }

  async scales(): Promise<ReferenceOption[]> {
    const rows = await this.prisma.scale.findMany({
      select: { id: true, code: true, name: true },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });

    return rows.map((row) => ({ id: row.id, value: row.code, label: row.name }));
  }

  async series(): Promise<ReferenceOption[]> {
    const rows = await this.prisma.series.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => ({ id: row.id, value: row.slug, label: row.name }));
  }

  async brands(): Promise<ReferenceOption[]> {
    const rows = await this.prisma.brand.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({ id: row.id, value: row.slug, label: row.name }));
  }
}
