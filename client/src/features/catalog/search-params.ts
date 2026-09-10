import { PRODUCT_SORTS, type ProductSort } from '@gunsnip/shared';

/**
 * The listing's state, read from and written to the query string.
 *
 * **The URL is the only source of truth** (FR-CAT-07). Nothing here is mirrored into React
 * state: a filter is applied by navigating, and the page re-renders from the new URL. That is
 * what makes the back button, a refresh and a pasted link all land on the same view — the DoD
 * §13.1 check — and it is why this module is plain functions over `URLSearchParams` rather than
 * a store.
 *
 * Everything is parsed defensively. A query string is user input: someone will hand-edit it,
 * and an unknown sort or a negative page must degrade to the default rather than throw.
 */

/** Multi-value filters. One name each, so the URL reads `?grade=MG&grade=RG`. */
/** Matches the API's own cap, so the client truncates rather than provoking a 400. */
export const MAX_QUERY_LENGTH = 120;

export const LIST_FILTER_KEYS = ['grade', 'scale', 'series', 'brand', 'difficulty', 'toolJob'] as const;

export type ListFilterKey = (typeof LIST_FILTER_KEYS)[number];

/**
 * Every filter key, with nothing selected.
 *
 * Written out rather than built from `LIST_FILTER_KEYS` with `Object.fromEntries`, whose return
 * type is a plain index signature — assigning that to the mapped type needs a cast, and a cast
 * here would hide the one mistake worth catching: adding a key to the union and forgetting it
 * exists. Spelled out, the compiler names the missing key.
 */
function emptyFilters(): Record<ListFilterKey, string[]> {
  return { grade: [], scale: [], series: [], brand: [], difficulty: [], toolJob: [] };
}

export interface ListState {
  /**
   * The search term, or null on a category listing (FR-SRCH-06).
   *
   * Part of the listing state rather than a prop threaded beside it, because every control that
   * builds a URL — the filter rail, the sort, the pagination — has to carry it forward, and one
   * that forgot would silently drop the customer's query on the next tick of a checkbox. Being
   * in `ListState` means they all preserve it without knowing it exists.
   */
  q: string | null;

  filters: Readonly<Record<ListFilterKey, readonly string[]>>;
  inStock: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  sort: ProductSort;
  /** The first page shown. Numbered pagination sets this. */
  page: number;
  /**
   * How many further pages have been appended by "Load more" (FR-CAT-09).
   *
   * A second parameter rather than folding it into `page`, because the two controls mean
   * different things and one number cannot carry both: clicking "5" must show page five, while
   * Load more must *keep* what is on screen and add to it. With both in the URL the accumulated
   * view is still a link someone can paste, and the back button steps back through the loads —
   * which is exactly what infinite scroll cannot do (FR-CAT-07).
   */
  more: number;
}

/** What a category listing gets when the URL names no sort. */
export const DEFAULT_SORT: ProductSort = 'newest';

/**
 * What a *search* gets when the URL names no sort.
 *
 * A category listing has nothing to be relevant to, so it falls back to recency; a search has
 * been asked a question and the ranking is the answer. The presence of `q` is what decides,
 * which keeps this rule in one place and stops the client disagreeing with the server about
 * which default applied — a disagreement that would show up as the API being told `sort=newest`
 * on a page the customer thinks is sorted by relevance.
 */
export const DEFAULT_SEARCH_SORT: ProductSort = 'relevance';

export function defaultSortFor(query: string | null): ProductSort {
  return query === null ? DEFAULT_SORT : DEFAULT_SEARCH_SORT;
}

/**
 * A ceiling on "Load more". Past this the accumulated page is long enough that the numbered
 * pages are the better tool, and each appended page is a request — an unbounded counter in a
 * hand-editable URL is an unbounded fan-out on the server.
 */
export const MAX_APPENDED_PAGES = 4;

/**
 * Next 16 hands a page `searchParams` as a plain record whose values are string or string[].
 * Normalising to `URLSearchParams` first means one parsing path for both that and the
 * `useSearchParams()` a client component reads.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function toSearchParams(raw: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;

    for (const entry of Array.isArray(value) ? value : [value]) {
      params.append(key, entry);
    }
  }

  return params;
}

export function parseListState(params: URLSearchParams): ListState {
  const filters = emptyFilters();

  for (const key of LIST_FILTER_KEYS) {
    filters[key] = params.getAll(key).filter((value) => value.length > 0);
  }

  const q = parseQuery(params.get('q'));

  return {
    q,
    filters,
    inStock: params.get('inStock') === 'true',
    minPrice: parsePositiveInt(params.get('minPrice')),
    maxPrice: parsePositiveInt(params.get('maxPrice')),
    sort: parseSort(params.get('sort'), q),
    page: parsePositiveInt(params.get('page')) ?? 1,
    more: Math.min(parsePositiveInt(params.get('more')) ?? 0, MAX_APPENDED_PAGES),
  };
}

/**
 * State back to a query string.
 *
 * Defaults are omitted rather than written out, so the canonical URL for an unfiltered listing
 * is the bare path — `?sort=newest&page=1` would be a second URL for the same view, which
 * splits analytics and gives search engines a duplicate to index.
 */
export function toQueryString(state: ListState): string {
  const params = new URLSearchParams();

  // First, so a shared link reads `?q=barbatos&grade=MG` rather than burying the query.
  if (state.q !== null) params.set('q', state.q);

  for (const key of LIST_FILTER_KEYS) {
    for (const value of state.filters[key]) params.append(key, value);
  }

  if (state.inStock) params.set('inStock', 'true');
  if (state.minPrice !== null) params.set('minPrice', String(state.minPrice));
  if (state.maxPrice !== null) params.set('maxPrice', String(state.maxPrice));
  if (state.sort !== defaultSortFor(state.q)) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.more > 0) params.set('more', String(state.more));

  const query = params.toString();
  return query.length === 0 ? '' : `?${query}`;
}

export function buildHref(pathname: string, state: ListState): string {
  return `${pathname}${toQueryString(state)}`;
}

/**
 * Toggling a filter value always returns to page 1. Staying on page 7 after narrowing the
 * results to four items is the single most common pagination bug, and it renders as an empty
 * grid that looks like the filter broke.
 */
export function toggleFilter(state: ListState, key: ListFilterKey, value: string): ListState {
  const current = state.filters[key];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];

  return { ...state, filters: { ...state.filters, [key]: next }, page: 1, more: 0 };
}

export function setInStock(state: ListState, inStock: boolean): ListState {
  return { ...state, inStock, page: 1, more: 0 };
}

export function setSort(state: ListState, sort: ProductSort): ListState {
  return { ...state, sort, page: 1, more: 0 };
}

/** A numbered page is a jump, so it discards anything "Load more" had appended. */
export function setPage(state: ListState, page: number): ListState {
  return { ...state, page: Math.max(1, page), more: 0 };
}

/** One more page appended below the current results, up to the cap. */
export function appendPage(state: ListState): ListState {
  return { ...state, more: Math.min(state.more + 1, MAX_APPENDED_PAGES) };
}

/**
 * The pages a given state covers, first to last. The listing fetches these together — they are
 * independent queries, and asking for them separately keeps each one individually cacheable
 * rather than producing a different large response for every depth of scroll.
 */
export function pagesToFetch(state: ListState): number[] {
  return Array.from({ length: state.more + 1 }, (_, offset) => state.page + offset);
}

/** Clears filters but keeps the sort — "clear all" means the filters, not the whole view. */
export function clearFilters(state: ListState): ListState {
  // `q` survives deliberately: "clear all filters" on a results page means the filters, not
  // the search that produced them.
  return {
    ...state,
    filters: emptyFilters(),
    inStock: false,
    minPrice: null,
    maxPrice: null,
    page: 1,
    more: 0,
  };
}

export function hasActiveFilters(state: ListState): boolean {
  return (
    state.inStock ||
    state.minPrice !== null ||
    state.maxPrice !== null ||
    LIST_FILTER_KEYS.some((key) => state.filters[key].length > 0)
  );
}

/** The query the API expects. Same vocabulary as the URL, which is why there is no mapping. */
export function toApiQuery(
  state: ListState,
  category: string | null,
  limit: number,
  page: number,
): string {
  const params = new URLSearchParams({ limit: String(limit) });

  // Mutually exclusive: a category listing is scoped by its category, a search by its query.
  // Sending both would forward a stray hand-typed `?q=` on /kits to /products, which does not
  // accept it — the API runs `forbidNonWhitelisted`, so it would 400 the whole page rather than
  // ignore the parameter.
  if (category !== null) params.set('category', category);
  else if (state.q !== null) params.set('q', state.q);

  for (const key of LIST_FILTER_KEYS) {
    for (const value of state.filters[key]) params.append(key, value);
  }

  if (state.inStock) params.set('inStock', 'true');
  if (state.minPrice !== null) params.set('minPrice', String(state.minPrice));
  if (state.maxPrice !== null) params.set('maxPrice', String(state.maxPrice));
  params.set('sort', state.sort);
  params.set('page', String(page));

  return params.toString();
}

/** Facets take the filters but never the sort or the page — counts do not paginate. */
export function toFacetQuery(state: ListState, category: string | null): string {
  const params = new URLSearchParams();

  // Same scoping rule as `toApiQuery`, and the reason `fetchFacetCount` can pick its endpoint
  // by looking for `q`: a query string carrying one is a search, and only a search.
  if (category !== null) params.set('category', category);
  else if (state.q !== null) params.set('q', state.q);

  for (const key of LIST_FILTER_KEYS) {
    for (const value of state.filters[key]) params.append(key, value);
  }

  if (state.inStock) params.set('inStock', 'true');
  if (state.minPrice !== null) params.set('minPrice', String(state.minPrice));
  if (state.maxPrice !== null) params.set('maxPrice', String(state.maxPrice));

  return params.toString();
}

function parseSort(value: string | null, query: string | null): ProductSort {
  return PRODUCT_SORTS.includes(value as ProductSort)
    ? (value as ProductSort)
    : defaultSortFor(query);
}

/**
 * A query string is user input and `?q=` with nothing after it is not a search. Trimmed to
 * match the server's normalisation, and capped at the same length the API accepts so an
 * over-long paste is truncated rather than answered with a 400.
 */
function parseQuery(value: string | null): string | null {
  if (value === null) return null;

  const trimmed = value.slice(0, MAX_QUERY_LENGTH).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
