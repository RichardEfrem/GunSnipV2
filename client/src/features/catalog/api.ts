import { serverApiFetch } from '@/lib/api-server';
import {
  categoryDetailSchema,
  categoryTreeSchema,
  facetsSchema,
  homeContentSchema,
  productDetailSchema,
  productPageSchema,
  type CategoryDetail,
  type CategoryNode,
  type Facets,
  type HomeContent,
  type ProductDetail,
  type ProductPage,
} from './schema';

/**
 * Every catalogue call the storefront makes (CLAUDE.md: no fetch calls in components).
 *
 * All of them are server-side. The catalogue is public, cacheable and rendered on the server —
 * FR-CAT-03 requires server-rendered products, and filtering is a navigation rather than a
 * client fetch (FR-CAT-07), so there is no client hook here to write.
 *
 * `revalidate` rather than no-store: the catalogue changes when an operator edits it, not per
 * request, and a store that re-queries Postgres for every visitor on the same listing is
 * spending its latency budget on nothing.
 */

/** Long enough to absorb a burst, short enough that a price change is live within a minute. */
const CATALOGUE_TTL_SECONDS = 60;

export async function fetchProducts(query: string): Promise<ProductPage> {
  return serverApiFetch(`/products?${query}`, {
    schema: productPageSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchFacets(query: string): Promise<Facets> {
  return serverApiFetch(`/products/facets?${query}`, {
    schema: facetsSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchProduct(slug: string): Promise<ProductDetail> {
  return serverApiFetch(`/products/${encodeURIComponent(slug)}`, {
    schema: productDetailSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  return serverApiFetch('/categories', {
    schema: categoryTreeSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchCategory(slug: string): Promise<CategoryDetail> {
  return serverApiFetch(`/categories/${encodeURIComponent(slug)}`, {
    schema: categoryDetailSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchHome(): Promise<HomeContent> {
  return serverApiFetch('/home', {
    schema: homeContentSchema,
    next: { revalidate: CATALOGUE_TTL_SECONDS, tags: ['catalogue'] },
  });
}
