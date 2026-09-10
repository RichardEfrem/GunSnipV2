import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { ProductFilterDto } from './dto/product-filter.dto.js';
import type { Facets } from './entities/facets.entity.js';
import type { Paginated } from './entities/paginated.entity.js';
import type { ProductDetail } from './entities/product-detail.entity.js';
import type { ProductSummary } from './entities/product-summary.entity.js';
import { FacetService } from './facet.service.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly facets: FacetService,
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
}
