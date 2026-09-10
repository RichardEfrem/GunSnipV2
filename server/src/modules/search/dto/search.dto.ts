import { ListProductsDto } from '../../catalog/dto/list-products.dto.js';
import { IsSearchTerm } from './search-term.decorator.js';

/**
 * A search request (FR-SRCH-02, FR-SRCH-06).
 *
 * Extends the listing DTO rather than redeclaring the filters, which is what makes FR-SRCH-06
 * true by construction: the results page takes the identical filter and sort vocabulary a
 * category page does, because it *is* the identical class. A filter added to the rail later
 * works here without anyone remembering to add it twice.
 */
export class SearchDto extends ListProductsDto {
  @IsSearchTerm()
  readonly q!: string;
}
