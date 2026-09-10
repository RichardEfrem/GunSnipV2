import { facetsSchema, type Facets } from '@/features/catalog/schema';
import { serverApiFetch } from '@/lib/api-server';
import { searchResultsSchema, type SearchResults } from './schema';

/**
 * The search calls made on the server (CLAUDE.md: no fetch calls in components).
 *
 * Mirrors `features/catalog/api.ts` exactly, including the revalidate window: a results page is
 * as cacheable as a listing, and the same query from two visitors should not be two round trips
 * to Postgres. The cache key is the query string, and the API normalises `q` before it does
 * anything else, so `Barbatos` and `barbatos ` do not become two entries.
 *
 * Autosuggest is deliberately not here — it runs in the browser, so it lives in `client-api.ts`.
 */
const SEARCH_TTL_SECONDS = 60;

export async function fetchSearchResults(query: string): Promise<SearchResults> {
  return serverApiFetch(`/search?${query}`, {
    schema: searchResultsSchema,
    next: { revalidate: SEARCH_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchSearchFacets(query: string): Promise<Facets> {
  return serverApiFetch(`/search/facets?${query}`, {
    schema: facetsSchema,
    next: { revalidate: SEARCH_TTL_SECONDS, tags: ['catalogue'] },
  });
}
