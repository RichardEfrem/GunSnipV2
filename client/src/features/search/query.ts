/**
 * Client-side rules about a search term.
 *
 * Deliberately tiny and deliberately duplicated from the server's `query-tokens.ts`: the API
 * enforces both of these as validation, and this is the copy that stops the browser making a
 * request it knows will be rejected. The server's copy is the one that matters — this one only
 * saves a round trip.
 */

/** Autosuggest waits for this much before asking (FR-SRCH-03). */
export const MIN_SUGGEST_LENGTH = 2;

export function normalizeQuery(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isSuggestable(query: string): boolean {
  return normalizeQuery(query).length >= MIN_SUGGEST_LENGTH;
}
