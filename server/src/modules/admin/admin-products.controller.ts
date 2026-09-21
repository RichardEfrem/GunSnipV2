import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import type { CursorPage } from '../../common/pagination/cursor-page.js';
import { ImageAdminService } from '../catalog/image-admin.service.js';
import { ProductAdminService } from '../catalog/product-admin.service.js';
import { RequirementAdminService } from '../catalog/requirement-admin.service.js';
import { VariantAdminService } from '../catalog/variant-admin.service.js';
import { ListAdminProductsDto } from '../catalog/dto/list-admin-products.dto.js';
import { ReorderDto } from '../catalog/dto/reorder.dto.js';
import { UpdateImageDto, UploadImageDto } from '../catalog/dto/write-image.dto.js';
import { CreateProductDto, UpdateProductDto } from '../catalog/dto/write-product.dto.js';
import { SetRequirementsDto } from '../catalog/dto/write-requirement.dto.js';
import { CreateVariantDto, UpdateVariantDto } from '../catalog/dto/write-variant.dto.js';
import { MAX_IMAGE_BYTES, type UploadedFile as StoredUpload } from '../media/media-storage.js';
import type { AdminProduct, AdminProductSummary } from '../catalog/entities/admin-product.entity.js';
import { SetProductStatusDto } from './dto/set-product-status.dto.js';
import { IdParamDto, ImageIdParamDto, VariantIdParamDto } from './dto/id-param.dto.js';

/**
 * Product management (FR-ADM-02 … FR-ADM-06).
 *
 * Parse, delegate, return — no Prisma, no domain conditionals (CLAUDE.md). Every route carries
 * the guard that has existed since Phase 0.
 *
 * Variant, image and requirement routes live here rather than in controllers of their own
 * because they address the same aggregate and all return the whole `AdminProduct`: a variant
 * write changes the product's price range, an image write changes which one is primary, and an
 * endpoint that returned only the row it wrote would leave the editor showing something stale.
 */
@Controller('admin/products')
@UseGuards(AdminGuard)
export class AdminProductsController {
  constructor(
    private readonly products: ProductAdminService,
    private readonly variants: VariantAdminService,
    private readonly images: ImageAdminService,
    private readonly requirements: RequirementAdminService,
  ) {}

  @Get()
  async list(@Query() query: ListAdminProductsDto): Promise<CursorPage<AdminProductSummary>> {
    return this.products.list(query);
  }

  @Get(':id')
  async detail(@Param() params: IdParamDto): Promise<AdminProduct> {
    return this.products.detail(params.id);
  }

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<AdminProduct> {
    return this.products.create(dto);
  }

  @Patch(':id')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateProductDto): Promise<AdminProduct> {
    return this.products.update(params.id, dto);
  }

  /** Draft → published → archived (FR-ADM-02). Its own route: publishing is not a field edit. */
  @Put(':id/status')
  async setStatus(@Param() params: IdParamDto, @Body() dto: SetProductStatusDto): Promise<AdminProduct> {
    return this.products.setStatus(params.id, dto.status);
  }

  // --------------------------------------------------------------------- variants (FR-ADM-03)

  @Post(':id/variants')
  async addVariant(@Param() params: IdParamDto, @Body() dto: CreateVariantDto): Promise<AdminProduct> {
    return this.variants.create(params.id, dto);
  }

  // ----------------------------------------------------------------------- images (FR-ADM-04)

  /**
   * Multipart upload, compressed to WebP on arrival. The size cap is enforced twice on purpose:
   * here, so a too-large body is refused before it is buffered in memory, and again in
   * `MediaStorage`, which is the rule's home and is reachable from a caller that does not come
   * through this interceptor.
   */
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async uploadImage(
    @Param() params: IdParamDto,
    @UploadedFile() file: StoredUpload | undefined,
    @Body() dto: UploadImageDto,
  ): Promise<AdminProduct> {
    return this.images.upload(params.id, file, dto);
  }

  @Put(':id/images/order')
  async reorderImages(@Param() params: IdParamDto, @Body() dto: ReorderDto): Promise<AdminProduct> {
    return this.images.reorder(params.id, dto);
  }

  // ----------------------------------------------------------- build requirements (FR-ADM-06)

  @Put(':id/requirements')
  async setRequirements(@Param() params: IdParamDto, @Body() dto: SetRequirementsDto): Promise<AdminProduct> {
    return this.requirements.set(params.id, dto);
  }
}

/**
 * Variant and image routes addressed by their own id rather than through their product.
 *
 * A second controller because the path is a different root — `/admin/variants/:variantId`, not
 * `/admin/products/:id/...`. Editing a variant needs only the variant's id, and making the
 * client carry the product id as well would be a second identifier to get wrong.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminVariantsController {
  constructor(
    private readonly variants: VariantAdminService,
    private readonly images: ImageAdminService,
  ) {}

  @Patch('variants/:variantId')
  async updateVariant(@Param() params: VariantIdParamDto, @Body() dto: UpdateVariantDto): Promise<AdminProduct> {
    return this.variants.update(params.variantId, dto);
  }

  @Patch('images/:imageId')
  async updateImage(@Param() params: ImageIdParamDto, @Body() dto: UpdateImageDto): Promise<AdminProduct> {
    return this.images.update(params.imageId, dto);
  }

  @Put('images/:imageId/primary')
  async setPrimaryImage(@Param() params: ImageIdParamDto): Promise<AdminProduct> {
    return this.images.setPrimary(params.imageId);
  }

  @Delete('images/:imageId')
  @HttpCode(HttpStatus.OK)
  async deleteImage(@Param() params: ImageIdParamDto): Promise<AdminProduct> {
    return this.images.remove(params.imageId);
  }
}
