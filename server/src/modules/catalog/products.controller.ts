import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { ProductFilterDto } from './dto/product-filter.dto.js';
import type { BuildRequirement } from './entities/build-requirement.entity.js';
import type { Facets } from './entities/facets.entity.js';
import type { Paginated } from './entities/paginated.entity.js';
import type { ProductDetail } from './entities/product-detail.entity.js';
import type { ProductSummary } from './entities/product-summary.entity.js';
import type { RelatedProducts } from './entities/related-products.entity.js';
import { FacetService } from './facet.service.js';
import { RelatedService } from './related.service.js';
import { RequirementService } from './requirement.service.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly facets: FacetService,
    private readonly requirements: RequirementService,
    private readonly related: RelatedService,
  ) {}

  @Get()
  async list(@Query() query: ListProductsDto): Promise<Paginated<ProductSummary>> {
    return this.catalog.list(query);
  }

  /**
   * Declared before `:slug`, or Nest would match "facets" as a product slug — route order is
   * declaration order, and a static segment has to be registered ahead of the parameter that
   * would otherwise swallow it.
   */
  @Get('facets')
  async facetCounts(@Query() query: ProductFilterDto): Promise<Facets> {
    return this.facets.facets(query);
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.catalog.detail(slug);
  }

  /** "What you'll need to build this" (FR-PDP-08). */
  @Get(':slug/requirements')
  async requirementsFor(@Param('slug') slug: string): Promise<BuildRequirement[]> {
    return this.requirements.forProduct(slug);
  }

  @Get(':slug/related')
  async relatedTo(@Param('slug') slug: string): Promise<RelatedProducts> {
    return this.related.forProduct(slug);
  }
}
