import { Injectable } from '@nestjs/common';
import type { SearchStrategy } from '@gunsnip/shared';
import { CatalogService } from '../catalog/catalog.service.js';
import type { Facets } from '../catalog/entities/facets.entity.js';
import { FacetService } from '../catalog/facet.service.js';
import type { SearchFacetsDto } from './dto/search-facets.dto.js';
import type { SearchDto } from './dto/search.dto.js';
import type { SuggestDto } from './dto/suggest.dto.js';
import type { SearchResults } from './entities/search-results.entity.js';
import type { Suggestions } from './entities/suggestion.entity.js';
import {
  candidatePhrases,
  toPrefixTerm,
  toQueryTerms,
  tokenize,
  type QueryTerm,
} from './query-tokens.js';
import { MAX_CANDIDATES, SearchRepository, type RankedMatch } from './search.repository.js';
import { SynonymRepository } from './synonym.repository.js';

/**
 * Search (FR-SRCH-02 … FR-SRCH-07).
 *
 * Owns the one decision that makes search feel like search: **exact first, close second, never
 * nothing.** Full-text answers when it can; trigram similarity answers when it cannot
 * (FR-SRCH-05); and when neither does, the response still carries a correction to click rather
 * than an empty grid (FR-SRCH-07).
 *
 * It deliberately owns no listing logic. Once the matching ids exist they go to `CatalogService`
 * and `FacetService` — the same two the category pages use — so a search result is a category
 * listing that happens to have been narrowed by a tsquery (FR-SRCH-06).
 */

/** Rows in the suggest panel when the request does not say. */
const DEFAULT_SUGGESTION_LIMIT = 6;

/** Categories below the products. Two or three is a shortcut; more is a second nav. */
const CATEGORY_SUGGESTION_LIMIT = 3;

/** A word shorter than this is not worth trying to correct — see `correct` below. */
const MIN_CORRECTABLE_LENGTH = 4;

@Injectable()
export class SearchService {
  constructor(
    private readonly index: SearchRepository,
    private readonly synonyms: SynonymRepository,
    private readonly catalog: CatalogService,
    private readonly facets: FacetService,
  ) {}

  async search(query: SearchDto): Promise<SearchResults> {
    const { matches, strategy } = await this.resolveMatches(query.q);

    const [page, didYouMean] = await Promise.all([
      this.catalog.listMatching(
        query,
        matches.map((match) => match.id),
      ),
      // Only when the exact query fell short. Offering a correction beside a perfect result set
      // reads as the search doubting itself.
      strategy === 'FULL_TEXT' ? Promise.resolve(null) : this.correct(query.q),
    ]);

    return { ...page, query: query.q, strategy, didYouMean };
  }

  /**
   * The rail's counts, scoped to what the query matched (FR-SRCH-06).
   *
   * A second endpoint rather than a field on the search response, mirroring `/products/facets`
   * exactly — the mobile filter sheet has to ask "what would this selection give me" without
   * replacing the results behind it (DESIGN.md §3.3), which it cannot do if counts only arrive
   * attached to a page of products.
   *
   * The cost is resolving the match set twice per page view. That is the same shape the category
   * page already pays for its two calls, and it keeps each one independently cacheable.
   */
  async facetsFor(query: SearchFacetsDto): Promise<Facets> {
    const { matches } = await this.resolveMatches(query.q);

    return this.facets.facets(
      query,
      matches.map((match) => match.id),
    );
  }

  /**
   * The autosuggest panel (FR-SRCH-03).
   *
   * The last token is matched as a whole word *or* as a prefix, because there is no way to
   * tell from a query string whether the customer has finished typing it — and guessing wrong
   * in either direction loses results. See `toTsquery` for why one form alone is not enough.
   */
  async suggest(query: SuggestDto): Promise<Suggestions> {
    const limit = query.limit ?? DEFAULT_SUGGESTION_LIMIT;
    const tokens = tokenize(query.q);
    const prefix = toPrefixTerm(tokens.at(-1));
    const terms = await this.toTerms(tokens.slice(0, -1));

    const matches = await this.index.findMatches(terms, prefix, limit);

    const [products, categories] = await Promise.all([
      this.index.suggestionsByIds(matches.map((match) => match.id)),
      this.index.suggestCategories(query.q, CATEGORY_SUGGESTION_LIMIT),
    ]);

    return { query: query.q, products, categories };
  }

  /**
   * Full text, then trigram, then nothing (FR-SRCH-02, FR-SRCH-05).
   *
   * The fallback is only reached when full text returned *zero* rows, never to top up a thin
   * result set. Mixing the two would put a fuzzy match above an exact one on the same page and
   * make the ranking impossible to explain — and "barbatso" only needs rescuing when "barbatso"
   * genuinely matched nothing.
   */
  private async resolveMatches(
    q: string,
  ): Promise<{ matches: RankedMatch[]; strategy: SearchStrategy }> {
    const terms = await this.toTerms(tokenize(q));
    const matches = await this.index.findMatches(terms, null, MAX_CANDIDATES);

    if (matches.length > 0) return { matches, strategy: 'FULL_TEXT' };

    const similar = await this.index.findSimilar(q, MAX_CANDIDATES);

    if (similar.length > 0) return { matches: similar, strategy: 'FUZZY' };

    return { matches: [], strategy: 'NONE' };
  }

  /** Tokens plus whatever the synonym table has to say about them (FR-SRCH-04). */
  private async toTerms(tokens: readonly string[]): Promise<QueryTerm[]> {
    if (tokens.length === 0) return [];

    const expansions = await this.synonyms.expansionsFor(candidatePhrases(tokens));

    return toQueryTerms(tokens, expansions);
  }

  /**
   * "Did you mean …" for the whole query (FR-SRCH-07).
   *
   * Only the longest word is corrected, and the rest of the query is kept around it. A
   * misspelling is nearly always in the distinctive word — "mg barbatso" is wrong about
   * "barbatso", not about "mg" — and short words are left alone because trigram similarity says
   * very little about them: "mg" is within a hair of "mk", and a suggestion that swaps one
   * correct short word for another correct short word is worse than silence.
   *
   * Returns null when the correction is the query, so the page never offers what was typed.
   */
  private async correct(q: string): Promise<string | null> {
    const tokens = tokenize(q);
    const target = longestToken(tokens);

    if (target === null) return null;

    const correction = await this.index.findCorrection(target);

    if (correction === null || correction === target) return null;

    const corrected = tokens.map((token) => (token === target ? correction : token)).join(' ');

    return corrected === q ? null : corrected;
  }
}

/** The most distinctive word, or null when every word is too short to say anything about. */
function longestToken(tokens: readonly string[]): string | null {
  let longest: string | null = null;

  for (const token of tokens) {
    if (token.length < MIN_CORRECTABLE_LENGTH) continue;
    if (longest === null || token.length > longest.length) longest = token;
  }

  return longest;
}
