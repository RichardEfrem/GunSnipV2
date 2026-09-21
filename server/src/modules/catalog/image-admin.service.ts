import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { ValidationError } from '../../common/errors/validation.error.js';
import { toAdminProduct } from './admin-product-mapper.js';
import type { UpdateImageDto, UploadImageDto } from './dto/write-image.dto.js';
import type { ReorderDto } from './dto/reorder.dto.js';
import type { AdminProduct } from './entities/admin-product.entity.js';
import { MediaStorage, type UploadedFile } from '../media/media-storage.js';
import { ProductWriteRepository } from './product-write.repository.js';

/**
 * Product imagery (FR-ADM-04): upload, reorder, designate a primary, remove.
 *
 * The file and the row are two different stores and cannot be one transaction, so the order is
 * chosen to fail in the harmless direction: on upload the file is written first, so a failed
 * insert leaves an unreferenced file rather than a row pointing at nothing; on delete the row
 * goes first, for the same reason. An orphaned file is invisible and reclaimable; a broken image
 * URL is on the storefront.
 */
@Injectable()
export class ImageAdminService {
  constructor(
    private readonly products: ProductWriteRepository,
    private readonly media: MediaStorage,
  ) {}

  async upload(productId: string, file: UploadedFile | undefined, dto: UploadImageDto): Promise<AdminProduct> {
    if (file === undefined) throw new ValidationError('No image file was attached.', { productId });

    if ((await this.products.findById(productId)) === null) {
      throw new NotFoundError('No product with that id.', { productId });
    }

    const stored = await this.media.store(file, 'products');

    return toAdminProduct(await this.products.createImage(productId, { ...stored, alt: dto.alt }));
  }

  async update(imageId: string, dto: UpdateImageDto): Promise<AdminProduct> {
    await this.requireImage(imageId);

    return toAdminProduct(
      await this.products.updateImage(imageId, dto.alt === undefined ? {} : { alt: dto.alt }),
    );
  }

  /**
   * The new arrangement, checked to be a permutation of what the product actually has.
   *
   * A partial list would silently leave the omitted images at their old positions, colliding
   * with the new ones; a list naming an image from another product would move it. Both are
   * caught here rather than producing a gallery whose order nobody can explain.
   */
  async reorder(productId: string, dto: ReorderDto): Promise<AdminProduct> {
    const existing = await this.products.imageIds(productId);

    if (existing.length === 0) throw new NotFoundError('That product has no images.', { productId });

    const sent = new Set(dto.ids);

    if (sent.size !== dto.ids.length || sent.size !== existing.length || !existing.every((id) => sent.has(id))) {
      throw new ValidationError("The new order has to list this product's images exactly once each.", {
        expected: existing.length,
        received: dto.ids.length,
      });
    }

    return toAdminProduct(await this.products.reorderImages(productId, dto.ids));
  }

  async setPrimary(imageId: string): Promise<AdminProduct> {
    const image = await this.requireImage(imageId);

    return toAdminProduct(await this.products.setPrimaryImage(image.productId, imageId));
  }

  async remove(imageId: string): Promise<AdminProduct> {
    const image = await this.requireImage(imageId);

    const product = await this.products.deleteImage(image.productId, imageId);
    await this.media.remove(image.url);

    return toAdminProduct(product);
  }

  private async requireImage(imageId: string): Promise<{ productId: string; url: string }> {
    const image = await this.products.findImage(imageId);
    if (image === null) throw new NotFoundError('No image with that id.', { imageId });

    return image;
  }
}
