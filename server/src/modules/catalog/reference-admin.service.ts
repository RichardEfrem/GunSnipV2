import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import type {
  CreateCategoryDto,
  CreateGradeDto,
  CreateNamedDto,
  CreateScaleDto,
  UpdateCategoryDto,
  UpdateGradeDto,
  UpdateNamedDto,
  UpdateScaleDto,
} from './dto/write-reference.dto.js';
import type { AdminCategory, AdminReferenceItem } from './entities/admin-reference.entity.js';
import { ReferenceWriteRepository } from './reference-write.repository.js';
import { resolveSlug, uniqueSlug } from './slug.js';

/**
 * Reference-data management (FR-ADM-09).
 *
 * These five tables are what the filter rail is built from, which is why nothing here deletes a
 * row that products still point at. A grade removed out from under 40 kits does not just break
 * the rail — `onDelete: Restrict` in the schema would refuse it anyway, and a foreign-key error
 * reaching an operator as a 500 is a worse answer than a sentence saying how many products are
 * in the way.
 */
@Injectable()
export class ReferenceAdminService {
  constructor(private readonly reference: ReferenceWriteRepository) {}

  // ------------------------------------------------------------------------------ grades

  async grades(): Promise<AdminReferenceItem[]> {
    return this.reference.grades();
  }

  async createGrade(dto: CreateGradeDto): Promise<AdminReferenceItem> {
    const code = dto.code.trim().toUpperCase();
    await this.assertKeyFree('grade', code);

    return this.reference.createGrade({
      code,
      name: dto.name,
      description: dto.description ?? null,
      position: dto.position ?? 0,
    });
  }

  async updateGrade(id: string, dto: UpdateGradeDto): Promise<AdminReferenceItem> {
    return this.reference.updateGrade(await this.requireId('grade', id), {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.description === undefined ? {} : { description: dto.description }),
      ...(dto.position === undefined ? {} : { position: dto.position }),
    });
  }

  async deleteGrade(id: string): Promise<void> {
    await this.assertUnused('grade', id, await this.reference.gradeUsage(id));
    await this.reference.deleteGrade(id);
  }

  // ------------------------------------------------------------------------------ scales

  async scales(): Promise<AdminReferenceItem[]> {
    return this.reference.scales();
  }

  async createScale(dto: CreateScaleDto): Promise<AdminReferenceItem> {
    const code = dto.code.trim();
    await this.assertKeyFree('scale', code);

    return this.reference.createScale({ code, name: dto.name, position: dto.position ?? 0 });
  }

  async updateScale(id: string, dto: UpdateScaleDto): Promise<AdminReferenceItem> {
    return this.reference.updateScale(await this.requireId('scale', id), {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.position === undefined ? {} : { position: dto.position }),
    });
  }

  async deleteScale(id: string): Promise<void> {
    await this.assertUnused('scale', id, await this.reference.scaleUsage(id));
    await this.reference.deleteScale(id);
  }

  // ------------------------------------------------------------------------------ series

  async series(): Promise<AdminReferenceItem[]> {
    return this.reference.series();
  }

  async createSeries(dto: CreateNamedDto): Promise<AdminReferenceItem> {
    const slug = await uniqueSlug(resolveSlug(dto.name, dto.slug), (candidate) =>
      this.reference.isSeriesSlugTaken(candidate),
    );

    return this.reference.createSeries({ name: dto.name, slug, position: dto.position ?? 0 });
  }

  async updateSeries(id: string, dto: UpdateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.updateSeries(await this.requireId('series', id), {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.position === undefined ? {} : { position: dto.position }),
    });
  }

  async deleteSeries(id: string): Promise<void> {
    await this.assertUnused('series', id, await this.reference.seriesUsage(id));
    await this.reference.deleteSeries(id);
  }

  // ------------------------------------------------------------------------------ brands

  async brands(): Promise<AdminReferenceItem[]> {
    return this.reference.brands();
  }

  async createBrand(dto: CreateNamedDto): Promise<AdminReferenceItem> {
    const slug = await uniqueSlug(resolveSlug(dto.name, dto.slug), (candidate) =>
      this.reference.isBrandSlugTaken(candidate),
    );

    return this.reference.createBrand({ name: dto.name, slug });
  }

  async updateBrand(id: string, dto: UpdateNamedDto): Promise<AdminReferenceItem> {
    return this.reference.updateBrand(
      await this.requireId('brand', id),
      dto.name === undefined ? {} : { name: dto.name },
    );
  }

  async deleteBrand(id: string): Promise<void> {
    await this.assertUnused('brand', id, await this.reference.brandUsage(id));
    await this.reference.deleteBrand(id);
  }

  // -------------------------------------------------------------------------- categories

  async categories(): Promise<AdminCategory[]> {
    return this.reference.categories();
  }

  async createCategory(dto: CreateCategoryDto): Promise<AdminCategory> {
    const slug = await uniqueSlug(resolveSlug(dto.name, dto.slug), (candidate) =>
      this.reference.isCategorySlugTaken(candidate),
    );

    await this.assertParentIsCompatible(dto.parentId ?? null, dto.type, null);

    return this.reference.createCategory({
      name: dto.name,
      slug,
      type: dto.type,
      parentId: dto.parentId ?? null,
      position: dto.position ?? 0,
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<AdminCategory> {
    const existing = await this.reference.findCategory(id);
    if (existing === null) throw new NotFoundError('No category with that id.', { id });

    if (dto.parentId !== undefined) {
      await this.assertParentIsCompatible(dto.parentId, existing.type, id);
    }

    return this.reference.updateCategory(id, {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.parentId === undefined ? {} : { parentId: dto.parentId }),
      ...(dto.position === undefined ? {} : { position: dto.position }),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    const children = await this.reference.categoryChildCount(id);

    if (children > 0) {
      throw new ConflictError(`That category has ${children} sub-categories. Move or remove them first.`, {
        id,
        children,
      });
    }

    await this.assertUnused('category', id, await this.reference.categoryUsage(id));
    await this.reference.deleteCategory(id);
  }

  /**
   * A category's parent has to be in the same tree, and cannot be the category itself or one of
   * its own descendants — a cycle would make `descendantIds` recurse until the request dies, and
   * the storefront calls that on every category page.
   */
  private async assertParentIsCompatible(
    parentId: string | null,
    type: AdminCategory['type'],
    selfId: string | null,
  ): Promise<void> {
    if (parentId === null) return;

    if (parentId === selfId) {
      throw new ValidationError('A category cannot be its own parent.', { id: selfId });
    }

    const parent = await this.reference.findCategory(parentId);
    if (parent === null) throw new NotFoundError('No category with that id to be the parent.', { parentId });

    if (parent.type !== type) {
      throw new ConflictError('A category has to sit in the same tree as its parent — kits or tools, not both.', {
        parentType: parent.type,
        type,
      });
    }

    if (selfId !== null && (await this.reference.categoryDescendantIds(selfId)).includes(parentId)) {
      throw new ValidationError('That would put the category inside one of its own sub-categories.', {
        id: selfId,
        parentId,
      });
    }
  }

  private async assertKeyFree(table: 'grade' | 'scale', key: string): Promise<void> {
    const taken = table === 'grade' ? await this.reference.isGradeCodeTaken(key) : await this.reference.isScaleCodeTaken(key);

    if (taken) throw new ConflictError(`A ${table} with the code ${key} already exists.`, { key });
  }

  private async requireId(table: string, id: string): Promise<string> {
    if (!(await this.reference.exists(table, id))) {
      throw new NotFoundError(`No ${table} with that id.`, { id });
    }

    return id;
  }

  private async assertUnused(table: string, id: string, usage: number): Promise<void> {
    if (usage > 0) {
      throw new ConflictError(
        `${usage} product${usage === 1 ? '' : 's'} still use this ${table}. Move them first.`,
        { id, usage },
      );
    }

    await this.requireId(table, id);
  }
}
