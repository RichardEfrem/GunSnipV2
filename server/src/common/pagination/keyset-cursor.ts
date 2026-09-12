import { ValidationError } from '../errors/validation.error.js';

/**
 * The cursor every admin list uses: the sort key and the id of the last row on the page.
 *
 * Keyset rather than offset, so a page costs the same at row 10 and row 100,000, and so a row
 * inserted while the operator is paging cannot shift a later page and hide a record. The id is
 * carried alongside the timestamp because timestamps collide — two orders placed in the same
 * millisecond would otherwise make one of them unreachable.
 *
 * Base64url-encoded JSON. Opaque on purpose: it is a position in a result set, not an API, and
 * encoding it stops a caller building one by hand and depending on the sort we chose today.
 */
export interface Keyset {
  /** The `ORDER BY` timestamp of the last row, ISO 8601. */
  at: Date;
  id: string;
}

export function encodeCursor(keyset: Keyset): string {
  return Buffer.from(JSON.stringify({ at: keyset.at.toISOString(), id: keyset.id }), 'utf8').toString('base64url');
}

/** Undefined for an absent cursor — the first page. Throws on one that cannot be read. */
export function decodeCursor(cursor: string | undefined): Keyset | undefined {
  if (cursor === undefined) return undefined;

  const keyset = tryDecode(cursor);

  if (keyset === null) {
    // A domain error rather than a 500: a stale or hand-edited cursor is a bad request, and the
    // operator's way out is to go back to the first page.
    throw new ValidationError('That page link is no longer valid — start from the first page.', { cursor });
  }

  return keyset;
}

function tryDecode(cursor: string): Keyset | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const { at, id } = parsed as { at?: unknown; id?: unknown };
  if (typeof at !== 'string' || typeof id !== 'string') return null;

  const parsedAt = new Date(at);
  return Number.isNaN(parsedAt.getTime()) ? null : { at: parsedAt, id };
}

/**
 * The `WHERE` half of a keyset walk over `(at DESC, id DESC)`, as a Prisma filter.
 *
 * Written as the tuple comparison `(at, id) < (cursor.at, cursor.id)` spelled out in OR form,
 * because Prisma has no row-value syntax. The two arms are "strictly older" and "same instant,
 * lower id" — together they are every row that sorts after the cursor and no row that sorts
 * before it.
 */
export function keysetFilter(
  keyset: Keyset | undefined,
  field: string,
): Record<string, unknown> | undefined {
  if (keyset === undefined) return undefined;

  return {
    OR: [{ [field]: { lt: keyset.at } }, { [field]: keyset.at, id: { lt: keyset.id } }],
  };
}
