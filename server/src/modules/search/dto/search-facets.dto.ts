import { ProductFilterDto } from '../../catalog/dto/product-filter.dto.js';
import { IsSearchTerm } from './search-term.decorator.js';

/**
 * The filter rail's counts for a search (FR-SRCH-06, FR-CAT-10).
 *
 * Extends the *filter* DTO, not the listing one, so it takes no sort and no page — counts do
 * not paginate, and the global pipe runs with `forbidNonWhitelisted`, so sending them would be
 * a 400 rather than something quietly ignored. Exactly the shape `/products/facets` takes, plus
 * the query term.
 */
export class SearchFacetsDto extends ProductFilterDto {
  @IsSearchTerm()
  readonly q!: string;
}
