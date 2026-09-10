import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SearchController } from './search.controller.js';
import { SearchRepository } from './search.repository.js';
import { SearchService } from './search.service.js';
import { SynonymRepository } from './synonym.repository.js';

/**
 * Search (FR-SRCH-01 … FR-SRCH-07).
 *
 * Depends on `CatalogModule` and not the other way round: search knows how to find products,
 * the catalogue knows what a product is, and only one of those needs the other. Everything it
 * borrows — listing, filters, facet counts, the card mapping — arrives through that module's
 * exported services rather than through a repository, so search cannot quietly grow a second
 * set of catalogue rules (FR-SRCH-06).
 */
@Module({
  imports: [CatalogModule],
  controllers: [SearchController],
  providers: [SearchService, SearchRepository, SynonymRepository],
})
export class SearchModule {}
