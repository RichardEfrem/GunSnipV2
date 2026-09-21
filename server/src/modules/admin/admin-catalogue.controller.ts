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
import { BannerAdminService } from '../catalog/banner-admin.service.js';
import type { AdminBanner } from '../catalog/banner.repository.js';
import { ReorderDto } from '../catalog/dto/reorder.dto.js';
import { CreateBannerDto, UpdateBannerDto } from '../catalog/dto/write-banner.dto.js';
import { MAX_IMAGE_BYTES, type UploadedFile as StoredUpload } from '../media/media-storage.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AdjustStockDto } from '../inventory/dto/adjust-stock.dto.js';
import { ListMovementsDto } from '../inventory/dto/list-movements.dto.js';
import type { StockLevelView, StockMovement } from '../inventory/entities/stock-movement.entity.js';
import { ReviewModerationService } from '../reviews/review-moderation.service.js';
import {
  ListReviewsDto,
  ModerateReviewDto,
  ReplyToReviewDto,
} from '../reviews/dto/moderate-review.dto.js';
import type { AdminReview, ReviewQueueCounts } from '../reviews/entities/admin-review.entity.js';
import { VoucherAdminService } from '../vouchers/voucher-admin.service.js';
import {
  CreateVoucherDto,
  ListVouchersDto,
  UpdateVoucherDto,
} from '../vouchers/dto/write-voucher.dto.js';
import type { AdminVoucher } from '../vouchers/entities/admin-voucher.entity.js';
import { IdParamDto, VariantIdParamDto } from './dto/id-param.dto.js';

/**
 * Stock adjustment (FR-ADM-05), vouchers (FR-ADM-10), review moderation (FR-ADM-11) and banners
 * (FR-ADM-12).
 *
 * Four small route groups sharing one controller because each is a handful of handlers over a
 * service that already owns its rules — four files of six lines each would be structure for its
 * own sake. Products and orders have their own controllers because they are large enough to earn
 * them.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCatalogueController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly vouchers: VoucherAdminService,
    private readonly reviews: ReviewModerationService,
    private readonly banners: BannerAdminService,
  ) {}

  // ------------------------------------------------------------------------ stock (FR-ADM-05)

  @Post('variants/:variantId/stock')
  @HttpCode(HttpStatus.OK)
  async adjustStock(@Param() params: VariantIdParamDto, @Body() dto: AdjustStockDto): Promise<StockLevelView> {
    return this.inventory.adjust(params.variantId, dto);
  }

  @Get('variants/:variantId/movements')
  async movements(
    @Param() params: VariantIdParamDto,
    @Query() query: ListMovementsDto,
  ): Promise<CursorPage<StockMovement>> {
    return this.inventory.movements(params.variantId, query);
  }

  // --------------------------------------------------------------------- vouchers (FR-ADM-10)

  @Get('vouchers')
  async listVouchers(@Query() query: ListVouchersDto): Promise<CursorPage<AdminVoucher>> {
    return this.vouchers.list(query);
  }

  @Get('vouchers/:id')
  async voucher(@Param() params: IdParamDto): Promise<AdminVoucher> {
    return this.vouchers.detail(params.id);
  }

  @Post('vouchers')
  async createVoucher(@Body() dto: CreateVoucherDto): Promise<AdminVoucher> {
    return this.vouchers.create(dto);
  }

  @Patch('vouchers/:id')
  async updateVoucher(@Param() params: IdParamDto, @Body() dto: UpdateVoucherDto): Promise<AdminVoucher> {
    return this.vouchers.update(params.id, dto);
  }

  @Delete('vouchers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVoucher(@Param() params: IdParamDto): Promise<void> {
    await this.vouchers.remove(params.id);
  }

  // ---------------------------------------------------------------------- reviews (FR-ADM-11)

  /** Declared before `:id`, or Nest would match "counts" as a review id. */
  @Get('reviews/counts')
  async reviewCounts(): Promise<ReviewQueueCounts> {
    return this.reviews.counts();
  }

  @Get('reviews')
  async listReviews(@Query() query: ListReviewsDto): Promise<CursorPage<AdminReview>> {
    return this.reviews.list(query);
  }

  @Get('reviews/:id')
  async review(@Param() params: IdParamDto): Promise<AdminReview> {
    return this.reviews.detail(params.id);
  }

  @Post('reviews/:id/moderation')
  @HttpCode(HttpStatus.OK)
  async moderateReview(@Param() params: IdParamDto, @Body() dto: ModerateReviewDto): Promise<AdminReview> {
    return this.reviews.moderate(params.id, dto);
  }

  @Put('reviews/:id/reply')
  async replyToReview(@Param() params: IdParamDto, @Body() dto: ReplyToReviewDto): Promise<AdminReview> {
    return this.reviews.reply(params.id, dto);
  }

  // ---------------------------------------------------------------------- banners (FR-ADM-12)

  @Get('banners')
  async listBanners(): Promise<AdminBanner[]> {
    return this.banners.list();
  }

  /** Compressed to WebP and stored; the banner is then created or updated with the URL. */
  @Post('banners/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async uploadBannerImage(@UploadedFile() file: StoredUpload | undefined): Promise<{ url: string }> {
    return this.banners.uploadImage(file);
  }

  @Post('banners')
  async createBanner(@Body() dto: CreateBannerDto): Promise<AdminBanner> {
    return this.banners.create(dto);
  }

  @Put('banners/order')
  async reorderBanners(@Body() dto: ReorderDto): Promise<AdminBanner[]> {
    return this.banners.reorder(dto);
  }

  @Patch('banners/:id')
  async updateBanner(@Param() params: IdParamDto, @Body() dto: UpdateBannerDto): Promise<AdminBanner> {
    return this.banners.update(params.id, dto);
  }

  @Delete('banners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBanner(@Param() params: IdParamDto): Promise<void> {
    await this.banners.remove(params.id);
  }
}
