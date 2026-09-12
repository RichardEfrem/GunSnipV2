import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { toAdminProduct } from './admin-product-mapper.js';
import type { CreateVariantDto, UpdateVariantDto } from './dto/write-variant.dto.js';
import type { AdminProduct } from './entities/admin-product.entity.js';
import { ProductWriteRepository } from './product-write.repository.js';

/**
 * Variant management (FR-ADM-03).
 *
 * Returns the whole product rather than the variant, on purpose: a variant write changes the
 * product's denormalised price range too, and an endpoint that returned only the row it wrote
 * would leave the screen showing a range that is already stale.
 *
 * Stock is not here. A variant's price is a catalogue edit; its stock level is an inventory
 * movement with a mandatory reason (FR-ADM-05), and `InventoryService` owns it. The one
 * exception is the opening balance, which the repository writes as a RESTOCK movement so the
 * rule holds from the variant's first unit.
 */
@Injectable()
export class VariantAdminService {
  constructor(private readonly products: ProductWriteRepository) {}

  async create(productId: string, dto: CreateVariantDto): Promise<AdminProduct> {
    if ((await this.products.findById(productId)) === null) {
      throw new NotFoundError('No product with that id.', { productId });
    }

    await this.assertSkuFree(dto.sku);
    this.assertComparePrice(dto.priceIdr, dto.compareAtPriceIdr);

    return toAdminProduct(
      await this.products.createVariant(
        productId,
        {
          sku: dto.sku,
          name: dto.name ?? null,
          optionValues: dto.optionValues ?? {},
          priceIdr: dto.priceIdr,
          compareAtPriceIdr: dto.compareAtPriceIdr ?? null,
          weightGrams: dto.weightGrams ?? 0,
          barcode: dto.barcode ?? null,
        },
        dto.openingStock ?? 0,
      ),
    );
  }

  async update(variantId: string, dto: UpdateVariantDto): Promise<AdminProduct> {
    const variant = await this.products.findVariant(variantId);
    if (variant === null) throw new NotFoundError('No variant with that id.', { variantId });

    if (dto.sku !== undefined && dto.sku !== variant.sku) {
      await this.assertSkuFree(dto.sku, variantId);
    }

    if (dto.priceIdr !== undefined || dto.compareAtPriceIdr !== undefined) {
      await this.assertComparePriceAgainstStored(variantId, dto);
    }

    return toAdminProduct(
      await this.products.updateVariant(variantId, {
        ...(dto.sku === undefined ? {} : { sku: dto.sku }),
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.optionValues === undefined ? {} : { optionValues: dto.optionValues }),
        ...(dto.priceIdr === undefined ? {} : { priceIdr: dto.priceIdr }),
        ...(dto.compareAtPriceIdr === undefined ? {} : { compareAtPriceIdr: dto.compareAtPriceIdr }),
        ...(dto.weightGrams === undefined ? {} : { weightGrams: dto.weightGrams }),
        ...(dto.barcode === undefined ? {} : { barcode: dto.barcode }),
        ...(dto.isArchived === undefined ? {} : { isArchived: dto.isArchived }),
      }),
    );
  }

  private async assertSkuFree(sku: string, exceptId?: string): Promise<void> {
    if (await this.products.isSkuTaken(sku, exceptId)) {
      throw new ConflictError(`SKU ${sku} already belongs to another variant.`, { sku });
    }
  }

  /**
   * The struck-through price has to be higher than the one being charged.
   *
   * FR-PROMO-03 computes the discount percentage from these two rather than letting anyone type
   * it, so a compare-at below the price would render as a negative discount — an advertised
   * saving that is a markup. A rule about what a price may claim, so it belongs in the service
   * rather than on the DTO, which cannot see both numbers of a partial update.
   */
  private assertComparePrice(priceIdr: number, compareAtPriceIdr: number | null | undefined): void {
    if (compareAtPriceIdr !== null && compareAtPriceIdr !== undefined && compareAtPriceIdr <= priceIdr) {
      throw new ValidationError('The struck-through price has to be higher than the price being charged.', {
        priceIdr,
        compareAtPriceIdr,
      });
    }
  }

  /** A partial update may change either number, so both are resolved against what is stored. */
  private async assertComparePriceAgainstStored(variantId: string, dto: UpdateVariantDto): Promise<void> {
    const stored = await this.products.findVariantPricing(variantId);
    if (stored === null) throw new NotFoundError('No variant with that id.', { variantId });

    this.assertComparePrice(
      dto.priceIdr ?? stored.priceIdr,
      dto.compareAtPriceIdr === undefined ? stored.compareAtPriceIdr : dto.compareAtPriceIdr,
    );
  }
}
