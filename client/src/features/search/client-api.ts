import { apiFetch } from '@/lib/api-client';
import { suggestionsSchema, type Suggestions } from './schema';

/**
 * Autosuggest (FR-SRCH-03).
 *
 * The one search call the browser makes, and it has to be: the panel answers keystrokes, and no
 * amount of server rendering can respond to a word that has not been submitted. Separate from
 * `api.ts` because that module reaches for `next/headers`, which cannot appear in a Client
 * Component's module graph.
 *
 * The `signal` is not optional. Suggestions are requested faster than they return, and without
 * an abort the answer to "barb" can arrive after the answer to "barbatos" and overwrite it.
 */
export async function fetchSuggestions(query: string, signal: AbortSignal): Promise<Suggestions> {
  const params = new URLSearchParams({ q: query });

  return apiFetch(`/search/suggest?${params.toString()}`, {
    schema: suggestionsSchema,
    signal,
  });
}
