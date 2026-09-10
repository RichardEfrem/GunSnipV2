import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * The community-name table (FR-SRCH-04).
 *
 * Its own repository rather than a method on the search one, because `search_synonym` is its
 * own aggregate: operators edit it in admin, it has no foreign key to a product, and it is the
 * one part of search that is data rather than index.
 */
@Injectable()
export class SynonymRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Expansions for whichever of these phrases the table knows, keyed by phrase.
   *
   * One query for every candidate phrase in the query rather than one per word: the caller has
   * already worked out that "nu gundam" is worth asking about as well as "nu" and "gundam", and
   * a round trip per candidate would spend more time in the driver than in Postgres.
   *
   * Terms are stored lower-cased by the seed and the caller normalises the same way, so this is
   * an exact-match lookup on a unique column — the trigram index on `term` is for the admin
   * screen searching the table, not for this.
   */
  async expansionsFor(phrases: readonly string[]): Promise<Map<string, string[]>> {
    if (phrases.length === 0) return new Map();

    const rows = await this.prisma.searchSynonym.findMany({
      where: { term: { in: [...phrases] } },
      select: { term: true, expansions: true },
    });

    return new Map(rows.map((row) => [row.term, row.expansions]));
  }
}
