import { Controller, Get, Query } from '@nestjs/common';
import type { Facets } from '../catalog/entities/facets.entity.js';
import { SearchFacetsDto } from './dto/search-facets.dto.js';
import { SearchDto } from './dto/search.dto.js';
import { SuggestDto } from './dto/suggest.dto.js';
import type { SearchResults } from './entities/search-results.entity.js';
import type { Suggestions } from './entities/suggestion.entity.js';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async results(@Query() query: SearchDto): Promise<SearchResults> {
    return this.search.search(query);
  }

  @Get('suggest')
  async suggest(@Query() query: SuggestDto): Promise<Suggestions> {
    return this.search.suggest(query);
  }

  @Get('facets')
  async facets(@Query() query: SearchFacetsDto): Promise<Facets> {
    return this.search.facetsFor(query);
  }
}
