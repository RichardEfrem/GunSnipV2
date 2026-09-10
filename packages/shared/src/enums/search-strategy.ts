/**
 * How a result set was found.
 *
 * The storefront says something different above each one, which is the whole reason this
 * crosses the wire: "showing close matches for barbatso" is only honest when the exact query
 * matched nothing (FR-SRCH-05), and a client that could not tell the two apart would either
 * apologise for a perfect result or silently pass off a fuzzy one as exact.
 */
export const SEARCH_STRATEGIES = [
  /** The tsvector matched, with synonyms folded in (FR-SRCH-02, FR-SRCH-04). */
  'FULL_TEXT',
  /** Nothing matched exactly, so trigram similarity answered instead (FR-SRCH-05). */
  'FUZZY',
  /** Neither found anything. The zero-result page takes over (FR-SRCH-07). */
  'NONE',
] as const;

export type SearchStrategy = (typeof SEARCH_STRATEGIES)[number];
