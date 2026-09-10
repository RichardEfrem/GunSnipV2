import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { ProductSuggestion } from './entities/suggestion.entity.js';
import type { PrefixTerm, QueryTerm } from './query-tokens.js';

/**
 * The search index: which products match some text, and how well (FR-SRCH-02, FR-SRCH-05).
 *
 * The only repository in the codebase that writes SQL by hand, for a reason Prisma states
 * itself — it has no `tsvector` type, no `@@`, no `ts_rank` and no trigram operators, so the
 * whole of full-text search is outside what the query builder can express.
 *
 * **Nothing here interpolates user text into SQL.** Every term arrives as a bind parameter
 * handed to `plainto_tsquery`, which takes plain text and cannot be talked into an operator —
 * unlike `to_tsquery`, which parses `&`, `|` and `!` out of its argument and throws on anything
 * malformed. The boolean structure a synonym needs is built from `||` and `&&` *between* those
 * calls, in SQL this file controls, rather than inside a string the customer supplied. The one
 * exception is the prefix match, which needs `to_tsquery`, and whose argument the tokeniser has
 * already stripped to letters and digits.
 *
 * These queries return ids and ranks, never product rows. Turning an id into something the
 * storefront can render is the catalogue's job, and going through it is what makes a search
 * result and a category listing the same card with the same rules (FR-SRCH-06).
 */

/** One product the query matched, and how strongly. Ordered best first. */
export interface RankedMatch {
  id: string;
  rank: number;
}

/**
 * The ceiling on candidates fed to the filter rail.
 *
 * Deep search pagination is a feature nobody uses and everybody pays for: past a few hundred
 * results the answer is "refine the query", not "page 40". Capping here bounds both the id list
 * the filters run over and the memory this holds, and the cap being generous relative to the
 * catalogue means it changes no real answer.
 */
export const MAX_CANDIDATES = 500;

/** Below this a "did you mean" is noise rather than help (FR-SRCH-07). */
const CORRECTION_THRESHOLD = 0.3;

/** Words shorter than this are too common for trigram similarity to say anything about. */
const MIN_CORRECTION_LENGTH = 3;

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text matches, best first (FR-SRCH-02).
   *
   * Ranked by `ts_rank` against the weighted vector the Phase 2 trigger maintains, so a hit on
   * a product's name outranks one on its series. `units_sold` breaks ties — among equally
   * relevant kits the one people actually buy is the better guess — and `id` breaks the rest,
   * without which two equal rows have no defined order and pagination can show the same product
   * twice.
   */
  async findMatches(
    terms: readonly QueryTerm[],
    prefix: PrefixTerm | null,
    limit: number,
  ): Promise<RankedMatch[]> {
    const tsquery = this.toTsquery(terms, prefix);

    if (tsquery === null) return [];

    const rows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      WITH query AS (SELECT ${tsquery} AS ts)
      SELECT p.id, ts_rank(p.search_vector, query.ts) AS rank
      FROM product p, query
      WHERE p.status = 'PUBLISHED' AND p.search_vector @@ query.ts
      ORDER BY rank DESC, p.units_sold DESC, p.id ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ id: row.id, rank: Number(row.rank) }));
  }

  /**
   * Trigram matches, for when full-text found nothing (FR-SRCH-05).
   *
   * `<%` — word similarity — rather than `%`. The difference is the whole feature: `%` compares
   * the query against the *entire* column, so "barbatso" scores about 0.19 against "HG 1/144
   * Gundam Barbatos" and falls under the 0.3 threshold, returning nothing. `<%` asks whether the
   * query closely matches any single *word* in the column, scores the same pair at 0.67, and
   * finds every Barbatos kit — which is DoD §13.2. Both use the same `gin_trgm_ops` indexes
   * built in Phase 2, so the better operator is not the slower one.
   *
   * The nullable columns are compared bare rather than through `COALESCE(unit_name, '')`, which
   * reads more defensively and is why it is worth spelling out: the index is on the column, so
   * wrapping it in a function makes the predicate unindexable and turns this into a sequential
   * scan of the catalogue. It also buys nothing. `'x' <% NULL` is NULL, which a WHERE treats as
   * no match, and `GREATEST` skips NULLs outright — the null handling the COALESCE looked like
   * it was providing is already in the operators.
   */
  async findSimilar(query: string, limit: number): Promise<RankedMatch[]> {
    const rows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      SELECT p.id,
             GREATEST(
               word_similarity(${query}, p.name),
               word_similarity(${query}, p.unit_name),
               word_similarity(${query}, p.unit_code)
             ) AS rank
      FROM product p
      WHERE p.status = 'PUBLISHED'
        AND (
          ${query} <% p.name
          OR ${query} <% p.unit_name
          OR ${query} <% p.unit_code
        )
      ORDER BY rank DESC, p.units_sold DESC, p.id ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ id: row.id, rank: Number(row.rank) }));
  }

  /**
   * The closest real word to what was typed, or null (FR-SRCH-07).
   *
   * The vocabulary is built from the catalogue itself — product names, unit names and the
   * synonym terms — rather than from a dictionary, so the correction offered is always a word
   * that leads somewhere. Suggesting a correctly spelled word the shop does not stock would
   * turn one dead end into two.
   */
  async findCorrection(query: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ word: string }[]>`
      WITH vocabulary AS (
            SELECT lower(word) AS word
              FROM product, unnest(string_to_array(name, ' ')) AS word
             WHERE status = 'PUBLISHED'
        UNION
            SELECT lower(word)
              FROM product, unnest(string_to_array(COALESCE(unit_name, ''), ' ')) AS word
             WHERE status = 'PUBLISHED'
        UNION
            SELECT term FROM search_synonym
      )
      SELECT word
      FROM vocabulary
      WHERE length(word) >= ${MIN_CORRECTION_LENGTH}
        AND similarity(${query}, word) > ${CORRECTION_THRESHOLD}
      ORDER BY similarity(${query}, word) DESC, word ASC
      LIMIT 1
    `;

    return rows[0]?.word ?? null;
  }

  /**
   * The panel's rows for an already-ranked set of ids (FR-SRCH-03).
   *
   * A projection of its own rather than a `ProductSummary`, because autosuggest is the most
   * latency-sensitive request in the store and a dropdown row shows a thumbnail, a name and a
   * price. Loading variants, ratings and stock to render three fields would make the fastest
   * thing the heaviest.
   *
   * Ordering is restored from `ids` afterwards: `IN` has no order, and the ranking is the point.
   */
  async suggestionsByIds(ids: readonly string[]): Promise<ProductSuggestion[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.product.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true,
        slug: true,
        name: true,
        images: {
          where: { isPrimary: true },
          select: { url: true, alt: true, blurDataUrl: true },
          take: 1,
        },
        variants: {
          where: { isArchived: false },
          select: { priceIdr: true },
          orderBy: { priceIdr: 'asc' },
          take: 1,
        },
      },
    });

    const byId = new Map(rows.map((row) => [row.id, row]));

    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (row === undefined) return [];

      const image = row.images[0];

      return [
        {
          id: row.id,
          slug: row.slug,
          name: row.name,
          priceIdr: row.variants[0]?.priceIdr ?? 0,
          image:
            image === undefined
              ? null
              : { url: image.url, alt: image.alt, blurDataUrl: image.blurDataUrl },
        },
      ];
    });
  }

  /**
   * Categories whose name contains the query (FR-SRCH-03).
   *
   * A plain substring match, not full-text: there are a few dozen categories with short
   * deliberate names, and "nip" should reach "Nippers" while it is still being typed — which
   * stemming would not do and a tsvector would not either.
   */
  async suggestCategories(query: string, limit: number): Promise<{ name: string; slug: string; productCount: number }[]> {
    const rows = await this.prisma.category.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: {
        name: true,
        slug: true,
        _count: { select: { products: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      productCount: row._count.products,
    }));
  }

  /**
   * The terms, as one `tsquery` expression.
   *
   * Each term becomes `plainto_tsquery(phrase) || plainto_tsquery(expansion) || …` — an OR, so
   * a synonym *widens* that term — and the terms are then AND'd together, so every word the
   * customer typed still has to be answered by something. "mg barbatos" stays narrower than
   * "barbatos" even though "barbatos" carries three expansions (FR-SRCH-04, FR-SRCH-05).
   *
   * Null when there is nothing to ask, which the caller reads as "no matches" rather than
   * sending a query that would match the whole catalogue.
   */
  private toTsquery(terms: readonly QueryTerm[], prefix: PrefixTerm | null): Prisma.Sql | null {
    const groups = terms.map((term) => {
      const alternatives = [term.phrase, ...term.expansions].map(
        (value) => Prisma.sql`plainto_tsquery('english', ${value})`,
      );

      return Prisma.sql`(${Prisma.join(alternatives, ' || ')})`;
    });

    // The word still being typed matches either way: as a whole word, or as a prefix.
    //
    // Both are needed and neither is enough. A prefix alone loses every part number, because
    // `:*` may only be attached to something with no operators in it and `rx-78-2` stripped to
    // `rx782` matches none of the lexemes the parser actually indexed ('rx-78', 'rx', '78',
    // '2'). A whole word alone loses "barb", which is not a word yet. OR-ing them means
    // `rx-78-2` is found by its left half and `barb` by its right, with no guess about whether
    // the customer has finished typing — which a query string cannot tell you anyway.
    //
    // Only `token` reaches `to_tsquery`, the one text-search entry point that parses operators
    // out of its argument, and the tokeniser has already reduced it to letters and digits.
    if (prefix !== null) {
      groups.push(
        Prisma.sql`(plainto_tsquery('english', ${prefix.phrase}) || to_tsquery('english', ${prefix.token} || ':*'))`,
      );
    }

    return groups.length === 0 ? null : Prisma.sql`(${Prisma.join(groups, ' && ')})`;
  }
}
