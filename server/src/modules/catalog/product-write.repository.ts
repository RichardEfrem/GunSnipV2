import { Injectable } from '@nestjs/common';
import type { ProductStatus } from '@gunsnip/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { priceRange } from './price-range.js';

/**
 * All Prisma access for catalogue writes (CLAUDE.md), over the product aggregate: the product
 * row and the variants, images and requirements that cascade from it.
 *
 * One repository rather than four because they are one aggregate — a variant has no life without
 * its product, and every variant write has to leave the product's denormalised price range
 * correct in the same transaction. Splitting them would mean either a second repository reaching
 * into `product`, or a service holding a transaction handle; both are the things the layering
 * rules exist to prevent.
 *
 * Reads for the storefront stay in `ProductRepository`. This file never serves a customer.
 */
export const ADMIN_PRODUCT_SELECT = {
  id: true,
  type: true,
  status: true,
  name: true,
  slug: true,
  description: true,
  tags: true,
  gradeId: true,
  scaleId: true,
  seriesId: true,
  unitName: true,
  unitCode: true,
  runnerCount: true,
  partCount: true,
  difficulty: true,
  decalType: true,
  articulationNotes: true,
  includes: true,
  releaseYear: true,
  runtimeMinutesEst: true,
  toolJob: true,
  attributes: true,
  minPriceIdr: true,
  maxPriceIdr: true,
  unitsSold: true,
  reviewCount: true,
  publishedAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    select: {
      id: true,
      sku: true,
      name: true,
      optionValues: true,
      priceIdr: true,
      compareAtPriceIdr: true,
      stockOnHand: true,
      stockReserved: true,
      weightGrams: true,
      barcode: true,
      position: true,
      isArchived: true,
    },
    // Archived variants included on purpose — an operator has to be able to see what they
    // retired, and to bring it back.
    orderBy: [{ position: 'asc' }, { sku: 'asc' }],
  },
  images: {
    select: { id: true, url: true, alt: true, blurDataUrl: true, position: true, isPrimary: true },
    orderBy: { position: 'asc' },
  },
  requiredTools: {
    select: {
      toolProductId: true,
      necessity: true,
      reason: true,
      position: true,
      tool: { select: { name: true, slug: true } },
    },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.ProductSelect;

export const ADMIN_SUMMARY_SELECT = {
  id: true,
  type: true,
  status: true,
  name: true,
  slug: true,
  minPriceIdr: true,
  maxPriceIdr: true,
  updatedAt: true,
  brand: { select: { name: true } },
  category: { select: { name: true } },
  images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
  variants: { select: { stockOnHand: true, stockReserved: true, isArchived: true } },
} satisfies Prisma.ProductSelect;

export type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;
export type AdminSummaryRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_SUMMARY_SELECT }>;

@Injectable()
export class ProductWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AdminProductRow | null> {
    return this.prisma.product.findUnique({ where: { id }, select: ADMIN_PRODUCT_SELECT });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } });
    return row !== null && row.id !== exceptId;
  }

  async list(where: Prisma.ProductWhereInput, take: number): Promise<AdminSummaryRow[]> {
    return this.prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take,
      select: ADMIN_SUMMARY_SELECT,
    });
  }

  /**
   * Creates the product and, for a kit, copies its grade's curated tool defaults onto it
   * (PRD §5.3) — in one transaction, so a kit never exists for a moment without the
   * requirements the operator asked for.
   */
  async create(data: Prisma.ProductUncheckedCreateInput, applyGradeDefaults: boolean): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data, select: { id: true, gradeId: true } });

      if (applyGradeDefaults && created.gradeId !== null) {
        const defaults = await tx.gradeToolDefault.findMany({
          where: { gradeId: created.gradeId },
          orderBy: { position: 'asc' },
          select: { toolProductId: true, necessity: true, reason: true, position: true },
        });

        await tx.productRequirement.createMany({
          data: defaults.map((row) => ({ kitProductId: created.id, ...row })),
          // A grade default naming the product being created would be a self-requirement; the
          // unique constraint is on (kit, tool) so it would not collide, but skipping is the
          // cheap guard against a default list that already overlaps something.
          skipDuplicates: true,
        });
      }

      return tx.product.findUniqueOrThrow({ where: { id: created.id }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput): Promise<AdminProductRow> {
    return this.prisma.product.update({ where: { id }, data, select: ADMIN_PRODUCT_SELECT });
  }

  /**
   * Publishing stamps `published_at` the first time only (FR-ADM-02).
   *
   * That column drives the "New" badge and the newest-first sort, so re-publishing after a
   * correction must not make a two-year-old kit new again. Unpublishing leaves it set: it
   * records when the product first went live, not whether it is live now — `status` answers
   * that.
   */
  async setStatus(id: string, status: ProductStatus, now: Date): Promise<AdminProductRow> {
    const current = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      select: { publishedAt: true },
    });

    const isFirstPublish = status === 'PUBLISHED' && current.publishedAt === null;

    return this.prisma.product.update({
      where: { id },
      data: { status, ...(isFirstPublish ? { publishedAt: now } : {}) },
      select: ADMIN_PRODUCT_SELECT,
    });
  }

  // --------------------------------------------------------------------------- variants

  /**
   * Adds a variant and leaves the product's price range correct, in one transaction.
   *
   * The opening balance is written as a RESTOCK movement rather than straight into the column,
   * so a variant's very first units have a row explaining where they came from — FR-ADM-05's
   * rule holds from the first unit, not from the first adjustment.
   */
  async createVariant(
    productId: string,
    data: Omit<Prisma.ProductVariantUncheckedCreateInput, 'productId' | 'position'>,
    openingStock: number,
  ): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.productVariant.findFirst({
        where: { productId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const variant = await tx.productVariant.create({
        data: { ...data, productId, position: (last?.position ?? -1) + 1, stockOnHand: openingStock },
        select: { id: true },
      });

      if (openingStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            variantId: variant.id,
            delta: openingStock,
            reason: 'RESTOCK',
            note: 'Opening balance when the variant was created.',
            actorKind: 'ADMIN',
          },
        });
      }

      await this.refreshPriceRange(tx, productId);

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  async updateVariant(variantId: string, data: Prisma.ProductVariantUpdateInput): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      const { productId } = await tx.productVariant.update({
        where: { id: variantId },
        data,
        select: { productId: true },
      });

      await this.refreshPriceRange(tx, productId);

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  async findVariant(variantId: string): Promise<{ id: string; productId: string; sku: string } | null> {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true, sku: true },
    });
  }

  /** A variant's two price columns, for the rule that one must exceed the other. */
  async findVariantPricing(variantId: string): Promise<{ priceIdr: number; compareAtPriceIdr: number | null } | null> {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { priceIdr: true, compareAtPriceIdr: true },
    });
  }

  async isSkuTaken(sku: string, exceptId?: string): Promise<boolean> {
    const row = await this.prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });
    return row !== null && row.id !== exceptId;
  }

  // ----------------------------------------------------------------------------- images

  /**
   * Appends an image. The first one a product gets is its primary, because a product with
   * images but no primary renders an empty card — the operator should not have to remember to
   * tick a box to avoid that.
   */
  async createImage(
    productId: string,
    image: { url: string; alt: string; blurDataUrl: string },
  ): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productImage.count({ where: { productId } });

      await tx.productImage.create({
        data: { ...image, productId, position: existing, isPrimary: existing === 0 },
      });

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  async updateImage(imageId: string, data: Prisma.ProductImageUpdateInput): Promise<AdminProductRow> {
    const { productId } = await this.prisma.productImage.update({
      where: { id: imageId },
      data,
      select: { productId: true },
    });

    return this.prisma.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
  }

  async findImage(imageId: string): Promise<{ id: string; productId: string; url: string; isPrimary: boolean } | null> {
    return this.prisma.productImage.findUnique({
      where: { id: imageId },
      select: { id: true, productId: true, url: true, isPrimary: true },
    });
  }

  /** The ids of a product's images, in their stored order — what a reorder is checked against. */
  async imageIds(productId: string): Promise<string[]> {
    const rows = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  /** Writes the new arrangement (FR-ADM-04). The caller has already checked it is a permutation. */
  async reorderImages(productId: string, ids: readonly string[]): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx.productImage.update({ where: { id }, data: { position } });
      }

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  /** Exactly one primary: the chosen row is set and every sibling cleared, in one transaction. */
  async setPrimaryImage(productId: string, imageId: string): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  /**
   * Removes an image and closes the gap it left, promoting the new first image to primary when
   * the deleted one held that role — so a product is never left with images and no primary.
   */
  async deleteImage(productId: string, imageId: string): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });

      const remaining = await tx.productImage.findMany({
        where: { productId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });

      for (const [position, row] of remaining.entries()) {
        await tx.productImage.update({
          where: { id: row.id },
          data: { position, isPrimary: position === 0 },
        });
      }

      return tx.product.findUniqueOrThrow({ where: { id: productId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  // ----------------------------------------------------------------------- requirements

  /**
   * Replaces a kit's tool requirements with exactly the list given (FR-ADM-06).
   *
   * Delete-then-insert rather than a diff. The list is short, the operator sent the whole
   * arrangement, and a diff would have to reconcile positions as well as membership — three
   * chances to get it wrong in return for saving a handful of rows.
   */
  async setRequirements(
    kitProductId: string,
    lines: readonly { toolProductId: string; necessity: Prisma.ProductRequirementCreateManyInput['necessity']; reason: string | null }[],
  ): Promise<AdminProductRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.productRequirement.deleteMany({ where: { kitProductId } });

      if (lines.length > 0) {
        await tx.productRequirement.createMany({
          data: lines.map((line, position) => ({ kitProductId, ...line, position })),
        });
      }

      return tx.product.findUniqueOrThrow({ where: { id: kitProductId }, select: ADMIN_PRODUCT_SELECT });
    });
  }

  /** Which of these ids are published tools — a requirement may only name a tool (PRD §5.3). */
  async publishedToolIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();

    const rows = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(ids)] }, type: 'TOOL_SUPPLY' },
      select: { id: true },
    });

    return new Set(rows.map((row) => row.id));
  }

  /** Recomputes the denormalised range from the variants as they now stand (`price-range.ts`). */
  private async refreshPriceRange(tx: Prisma.TransactionClient, productId: string): Promise<void> {
    const variants = await tx.productVariant.findMany({
      where: { productId },
      select: { priceIdr: true, isArchived: true },
    });

    await tx.product.update({ where: { id: productId }, data: priceRange(variants) });
  }
}
