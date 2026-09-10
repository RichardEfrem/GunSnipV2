import type { SearchStrategy } from '@gunsnip/shared';
import type { Paginated } from '../../catalog/entities/paginated.entity.js';
import type { ProductSummary } from '../../catalog/entities/product-summary.entity.js';

/**
 * A page of search results (FR-SRCH-02, FR-SRCH-06).
 *
 * A `Paginated<ProductSummary>` with three extra fields, and deliberately not a different shape
 * — the results page renders the same grid, the same cards and the same pagination as a
 * category listing, so anything that made the payload diverge would fork the components too.
 */
export interface SearchResults extends Paginated<ProductSummary> {
  /** The query as it was interpreted: trimmed, lower-cased, capped. Echoed so the page can
   *  quote it back without re-deriving it and getting a different answer. */
  query: string;

  strategy: SearchStrategy;

  /**
   * A correction worth offering (FR-SRCH-05, FR-SRCH-07).
   *
   * Set whenever the catalogue holds a word close to what was typed — on a fuzzy hit it
   * explains the results, and on no hit at all it is the way out of the dead end. Null when
   * nothing in the vocabulary is close enough to be worth suggesting; an unhelpful "did you
   * mean" is worse than none, because it teaches people to stop reading it.
   */
  didYouMean: string | null;
}
