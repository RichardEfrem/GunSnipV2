import { serverApiFetch } from '@/lib/api-server';
import { bundleListSchema, bundleSchema, type Bundle } from './schema';

/**
 * Bundle reads, all server-side (CLAUDE.md: no fetch calls in components).
 *
 * Cached like the rest of the catalogue: a bundle changes when an operator edits it, not per
 * visitor. Its availability is derived from live stock, so the TTL is the same short one the
 * product listing uses rather than something longer.
 */
const BUNDLE_TTL_SECONDS = 60;

export async function fetchBundles(): Promise<Bundle[]> {
  return serverApiFetch('/bundles', {
    schema: bundleListSchema,
    next: { revalidate: BUNDLE_TTL_SECONDS, tags: ['catalogue'] },
  });
}

export async function fetchBundle(slug: string): Promise<Bundle> {
  return serverApiFetch(`/bundles/${encodeURIComponent(slug)}`, {
    schema: bundleSchema,
    next: { revalidate: BUNDLE_TTL_SECONDS, tags: ['catalogue'] },
  });
}
