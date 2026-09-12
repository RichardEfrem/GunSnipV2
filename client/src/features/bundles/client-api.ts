import { cartSchema, type Cart } from '@/features/cart/schema';
import { apiFetch } from '@/lib/api-client';

/**
 * Adding a bundle from the browser (FR-CAT-11).
 *
 * Sends a slug and a count and nothing else: the bundle's price is read from the database on the
 * server (CLAUDE.md non-negotiable #2), and the components it expands into are the server's
 * business — a client that named them could name a different set.
 */
export async function addBundleToCart(slug: string, quantity = 1): Promise<Cart> {
  return apiFetch('/cart/bundles', { schema: cartSchema, method: 'POST', body: { slug, quantity } });
}
