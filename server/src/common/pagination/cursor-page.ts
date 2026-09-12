/**
 * One page of a cursor-paginated list — the rule CLAUDE.md sets for every list endpoint, and
 * what the admin lists use.
 *
 * The storefront listing is the documented exception (`ListProductsDto`): FR-CAT-09 asks for
 * numbered pages and FR-CAT-07 makes the URL the whole state, neither of which an opaque token
 * can express. Nobody links a colleague to "page 7 of the order list", so admin keeps the
 * cursor, and with it a page size that stays cheap however deep the operator scrolls.
 */
export interface CursorPage<T> {
  items: readonly T[];
  /** Pass back as `?cursor=` for the next page. Null when this page is the last. */
  nextCursor: string | null;
}

/**
 * Turns `limit + 1` rows into a page of `limit`.
 *
 * Reading one extra row is how `nextCursor` is known to be real: a cursor derived from the last
 * row of a full page would still be sent when that row happened to be the final one, and the
 * operator would click into an empty page.
 */
export function toCursorPage<T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => string,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last !== undefined ? cursorOf(last) : null,
  };
}
