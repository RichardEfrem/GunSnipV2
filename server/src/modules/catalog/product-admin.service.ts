import { Injectable } from '@nestjs/common';
import type { ProductStatus, ProductType } from '@gunsnip/shared';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { type CursorPage, toCursorPage } from '../../common/pagination/cursor-page.js';
import { decodeCursor, encodeCursor, keysetFilter } from '../../common/pagination/keyset-cursor.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toAdminProduct, toAdminProductSummary } from './admin-product-mapper.js';
import {
  DEFAULT_ADMIN_PAGE_SIZE,
  type ListAdminProductsDto,
} from './dto/list-admin-products.dto.js';
import type { CreateProductDto, KitFieldsDto, ToolFieldsDto, UpdateProductDto } from './dto/write-product.dto.js';
import type { AdminProduct, AdminProductSummary } from './entities/admin-product.entity.js';
import { ProductWriteRepository } from './product-write.repository.js';
import { resolveSlug, uniqueSlug } from './slug.js';

/**
 * Product CRUD for the back office (FR-ADM-02).
 *
 * Owns the two rules the transport cannot express:
 *
 * 1. **A product's type decides which fields exist.** `CreateProductDto` carries both groups
 *    because there is one endpoint; this service rejects the group that does not belong. A tool
 *    with a `runnerCount` is not a harmless stray column — it is a row the kit filter rail would
 *    happily count.
 * 2. **A product's type never changes.** Changing MODEL_KIT to TOOL_SUPPLY would strand its
 *    grade, its requirements and every order line that snapshotted it as a kit. Archive it and
 *    create the right thing; that is what `status` is for.
 */
@Injectable()
export class ProductAdminService {
  constructor(private readonly products: ProductWriteRepository) {}

  async list(query: ListAdminProductsDto): Promise<CursorPage<AdminProductSummary>> {
    const limit = query.limit ?? DEFAULT_ADMIN_PAGE_SIZE;
    const rows = await this.products.list(this.listWhere(query), limit + 1);

    return toCursorPage(rows.map(toAdminProductSummary), limit, (row) =>
      encodeCursor({ at: new Date(row.updatedAt), id: row.id }),
    );
  }

  async detail(id: string): Promise<AdminProduct> {
    return toAdminProduct(await this.require(id));
  }

  async create(dto: CreateProductDto): Promise<AdminProduct> {
    this.assertFieldsMatchType(dto.type, dto.kit, dto.tool);

    const slug = await uniqueSlug(resolveSlug(dto.name, dto.slug), (candidate) =>
      this.products.isSlugTaken(candidate),
    );

    const row = await this.products.create(
      {
        type: dto.type,
        // Always a draft. FR-ADM-02 makes publishing a deliberate second act, and a product with
        // no variants and no images has nothing to sell anyway.
        status: 'DRAFT',
        name: dto.name,
        slug,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        brandId: dto.brandId,
        categoryId: dto.categoryId,
        ...this.kitData(dto.kit),
        ...this.toolData(dto.tool),
      },
      dto.applyGradeDefaults ?? true,
    );

    return toAdminProduct(row);
  }

  async update(id: string, dto: UpdateProductDto): Promise<AdminProduct> {
    const existing = await this.require(id);
    this.assertFieldsMatchType(existing.type, dto.kit, dto.tool);

    const slug =
      dto.slug === undefined
        ? undefined
        : await uniqueSlug(resolveSlug(dto.name ?? existing.name, dto.slug), (candidate) =>
            this.products.isSlugTaken(candidate, id),
          );

    return toAdminProduct(
      await this.products.update(id, {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(slug === undefined ? {} : { slug }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.brandId === undefined ? {} : { brandId: dto.brandId }),
        ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
        ...(dto.tags === undefined ? {} : { tags: dto.tags }),
        ...this.kitData(dto.kit),
        ...this.toolData(dto.tool),
      }),
    );
  }

  /**
   * Draft → published → archived (FR-ADM-02).
   *
   * Publishing refuses a product nobody could buy. A published product with no sellable variant
   * renders a card with no price and an add-to-cart button that cannot work — catching that here
   * costs one query and saves the storefront from having to handle a state that should not exist.
   */
  async setStatus(id: string, status: ProductStatus): Promise<AdminProduct> {
    const existing = await this.require(id);

    if (status === 'PUBLISHED') {
      const sellable = existing.variants.filter((variant) => !variant.isArchived);

      if (sellable.length === 0) {
        throw new ValidationError('Add at least one variant before publishing — there is nothing to sell yet.', {
          productId: id,
        });
      }

      if (existing.images.length === 0) {
        throw new ValidationError('Add at least one image before publishing — the card would render empty.', {
          productId: id,
        });
      }
    }

    return toAdminProduct(await this.products.setStatus(id, status, new Date()));
  }

  private listWhere(query: ListAdminProductsDto): Prisma.ProductWhereInput {
    const term = query.q?.trim();

    return {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.type === undefined ? {} : { type: query.type }),
      ...(term === undefined || term.length === 0
        ? {}
        : {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { slug: { contains: term, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
            ],
          }),
      ...keysetFilter(decodeCursor(query.cursor), 'updatedAt'),
    };
  }

  private async require(id: string): Promise<NonNullable<Awaited<ReturnType<ProductWriteRepository['findById']>>>> {
    const row = await this.products.findById(id);
    if (row === null) throw new NotFoundError('No product with that id.', { productId: id });

    return row;
  }

  /** Rule 1: the fields have to match the type the product actually is. */
  private assertFieldsMatchType(
    type: ProductType,
    kit: KitFieldsDto | undefined,
    tool: ToolFieldsDto | undefined,
  ): void {
    if (type === 'MODEL_KIT' && tool !== undefined) {
      throw new ConflictError('Tool fields do not belong on a model kit.', { type });
    }

    if (type === 'TOOL_SUPPLY' && kit !== undefined) {
      throw new ConflictError('Kit fields do not belong on a tool or supply.', { type });
    }
  }

  /**
   * Absent leaves every kit column alone; a present group writes exactly the keys it carries, so
   * `{ "scaleId": null }` clears the scale and omitting it does not.
   *
   * Written against Prisma's *unchecked* input, which takes `gradeId` as a plain column rather
   * than a `connect`/`disconnect` relation. That is what lets one helper serve both create and
   * update: `null` means "no grade" in both, whereas the checked form spells clearing as
   * `disconnect`, which create does not accept.
   */
  private kitData(kit: KitFieldsDto | undefined): ProductColumns {
    if (kit === undefined) return {};

    return {
      ...column('gradeId', kit.gradeId),
      ...column('scaleId', kit.scaleId),
      ...column('seriesId', kit.seriesId),
      ...column('unitName', kit.unitName),
      ...column('unitCode', kit.unitCode),
      ...column('runnerCount', kit.runnerCount),
      ...column('partCount', kit.partCount),
      ...column('difficulty', kit.difficulty),
      ...column('decalType', kit.decalType),
      ...column('articulationNotes', kit.articulationNotes),
      ...(kit.includes === undefined ? {} : { includes: kit.includes }),
      ...column('releaseYear', kit.releaseYear),
      ...column('runtimeMinutesEst', kit.runtimeMinutesEst),
    };
  }

  private toolData(tool: ToolFieldsDto | undefined): ProductColumns {
    if (tool === undefined) return {};

    return {
      ...column('toolJob', tool.toolJob),
      // JSONB. The DTO has already established it is an object; Prisma's `InputJsonValue` is a
      // structurally narrower type than `Record<string, unknown>` and will not accept it
      // without being told that the object is JSON-shaped, which `@IsObject()` is what proves.
      ...(tool.attributes === undefined ? {} : { attributes: tool.attributes as Prisma.InputJsonObject }),
    };
  }
}

/**
 * The columns a kit or tool group writes. Assignable into both unchecked create and unchecked
 * update, which is the whole reason the helpers below return a plain record rather than one of
 * Prisma's two input types.
 */
type ProductColumns = Partial<Prisma.ProductUncheckedCreateInput> & Partial<Prisma.ProductUncheckedUpdateInput>;

/** A scalar column: absent is untouched, null is cleared. */
function column<K extends string, V>(key: K, value: V | null | undefined): Record<K, V | null> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V | null>);
}
