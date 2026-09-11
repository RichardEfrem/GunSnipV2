import { serverApiFetch } from '@/lib/api-server';
import { cartSchema, type Cart } from './schema';

/**
 * The cart, read on the server.
 *
 * `no-store`, unlike the catalogue: a cart is per-visitor and caching one would be a way to
 * serve somebody else's. The revalidate/tags pattern in `features/catalog/api.ts` is right for
 * public data and wrong for this.
 */
export async function fetchCart(): Promise<Cart> {
  return serverApiFetch('/cart', { schema: cartSchema, cache: 'no-store' });
}
