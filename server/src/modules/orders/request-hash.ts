import { createHash } from 'node:crypto';

/**
 * A fingerprint of a request body, stored beside its `Idempotency-Key` (FR-CO-07).
 *
 * A retry is only a retry if it is the same request, so a key presented again is compared by
 * this hash before its order is returned. Keys are sorted first: two serialisations of the same
 * body must hash alike, and JSON does not promise key order. Array order is kept — it is part of
 * what a list means.
 */
export function requestHash(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      // Absent and undefined are the same request, as they are once serialised.
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}
