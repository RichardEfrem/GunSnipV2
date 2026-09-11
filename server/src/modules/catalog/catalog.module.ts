import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoryRepository } from './category.repository.js';
import { CategoryService } from './category.service.js';
import { FacetService } from './facet.service.js';
import { HomeController } from './home.controller.js';
import { HomeRepository } from './home.repository.js';
import { HomeService } from './home.service.js';
import { ProductRepository } from './product.repository.js';
import { ProductsController } from './products.controller.js';
import { ReferenceRepository } from './reference.repository.js';
import { RelatedService } from './related.service.js';
import { RequirementRepository } from './requirement.repository.js';
import { RequirementService } from './requirement.service.js';

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
  ],
  // `RequirementService` is exported for the cart: adding a kit's tools in one action
  // (FR-PDP-08) means the cart has to resolve the same list the product page showed.
  exports: [CatalogService, CategoryService, FacetService, RequirementService],
})
export class CatalogModule {}
