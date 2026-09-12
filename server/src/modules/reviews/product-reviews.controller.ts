import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListProductReviewsDto } from './dto/list-product-reviews.dto.js';
import type { ProductReviewsPage } from './entities/product-review.entity.js';
import { ReviewListingService } from './review-listing.service.js';

/**
 * `GET /products/:slug/reviews` (PRD §10, FR-REV-05).
 *
 * Lives in the reviews module rather than on `ProductsController`, even though it hangs off a
 * product path: the URL is addressed the way the storefront addresses everything — by slug —
 * while the thing being returned belongs to this bounded context. Putting it on the catalogue's
 * controller would make the catalogue module depend on reviews for a route it does not own.
 */
@Controller('products/:slug/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewListingService) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query() query: ListProductReviewsDto,
  ): Promise<ProductReviewsPage> {
    return this.reviews.listForProduct(slug, query);
  }
}
