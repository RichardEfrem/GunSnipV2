import { apiFetch } from '@/lib/api-client';
import { facetsSchema, type Facets } from './schema';

/**
 * The catalogue calls the browser makes.
 *
 * Separate from `api.ts` because that module reaches for `next/headers`, which cannot appear in
 * a Client Component's module graph. There is exactly one call here, and it exists for one
 * reason: the mobile filter sheet shows a live "Show N kits" count for a selection that has not
 * been committed to the URL yet (DESIGN.md §3.3), which no amount of server rendering can
 * answer because the state does not exist anywhere the server can see.
 *
 * The endpoint is chosen from the query string rather than passed in. A search results page runs
 * this identical sheet over a set the catalogue endpoint knows nothing about (FR-SRCH-06), so a
 * count from `/products/facets` there would quietly promise the whole catalogue's total. Reading
 * it off `q` keeps that decision in one place instead of in a prop every call site has to
 * remember to thread.
 */
export async function fetchFacetCount(query: string, signal: AbortSignal): Promise<Facets> {
  const path = new URLSearchParams(query).has('q') ? '/search/facets' : '/products/facets';

  return apiFetch(`${path}?${query}`, { schema: facetsSchema, signal });
}
