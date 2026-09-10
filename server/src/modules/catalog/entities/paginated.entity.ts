/**
 * One page of a list, with enough to draw both pagination controls FR-CAT-09 asks for:
 * `total` for the "218 kits" heading and the numbered pages, `hasMore` for "Load more".
 *
 * `totalPages` is derived from the other two and sent anyway — it is computed once here rather
 * than in every consumer, and a client that rounds it differently would render a page number
 * that returns nothing.
 */
export interface Paginated<T> {
  items: readonly T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(items: readonly T[], page: number, limit: number, total: number): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
