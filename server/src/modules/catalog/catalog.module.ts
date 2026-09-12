import { Module } from '@nestjs/common';
import { BannerAdminService } from './banner-admin.service.js';
import { BannerRepository } from './banner.repository.js';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoryRepository } from './category.repository.js';
import { CategoryService } from './category.service.js';
import { FacetService } from './facet.service.js';
import { HomeController } from './home.controller.js';
import { HomeRepository } from './home.repository.js';
import { HomeService } from './home.service.js';
import { ImageAdminService } from './image-admin.service.js';
import { MediaStorage } from './media-storage.js';
import { ProductAdminService } from './product-admin.service.js';
import { ProductWriteRepository } from './product-write.repository.js';
import { ProductRepository } from './product.repository.js';
import { ProductsController } from './products.controller.js';
import { ReferenceAdminService } from './reference-admin.service.js';
import { ReferenceWriteRepository } from './reference-write.repository.js';
import { ReferenceRepository } from './reference.repository.js';
import { RelatedService } from './related.service.js';
import { RequirementAdminService } from './requirement-admin.service.js';
import { RequirementRepository } from './requirement.repository.js';
import { RequirementService } from './requirement.service.js';
import { VariantAdminService } from './variant-admin.service.js';

/**
 * The catalogue bounded context: browsing products, the taxonomy they hang off, and the home
 * page built from both.
 *
 * `CatalogService`, `CategoryService` and `FacetService` are exported because search, the
 * product page (Phase 5) and admin (Phase 9) all read the catalogue through them rather than
 * reaching for a repository — the storefront and the back office run the same rules by
 * construction. Search adds `FacetService` to that list: FR-SRCH-06 requires the results page
 * to carry the identical filter rail, which means the identical counts from the identical code.
 */
@Module({
  controllers: [ProductsController, CategoriesController, HomeController],
  providers: [
    CatalogService,
    CategoryService,
    FacetService,
    HomeService,
    RequirementService,
    RelatedService,
    ProductRepository,
    RequirementRepository,
    CategoryRepository,
    ReferenceRepository,
    HomeRepository,

    // The write half (FR-ADM-02 … FR-ADM-06, FR-ADM-09, FR-ADM-12). It lives here rather than in
    // the admin module because these are the catalogue's rules — what a product may be, which
    // fields its type allows, when a slug is free — and a back office that owned its own copy of
    // them would be a second catalogue.
    ProductAdminService,
    VariantAdminService,
    ImageAdminService,
    RequirementAdminService,
    ReferenceAdminService,
    BannerAdminService,
    ProductWriteRepository,
    ReferenceWriteRepository,
    BannerRepository,
    MediaStorage,
  ],
  // `RequirementService` is exported for the cart: adding a kit's tools in one action
  // (FR-PDP-08) means the cart has to resolve the same list the product page showed.
  exports: [
    CatalogService,
    CategoryService,
    FacetService,
    RequirementService,
    ProductAdminService,
    VariantAdminService,
    ImageAdminService,
    RequirementAdminService,
    ReferenceAdminService,
    BannerAdminService,
  ],
})
export class CatalogModule {}
