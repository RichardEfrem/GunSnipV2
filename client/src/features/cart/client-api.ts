import { apiFetch } from '@/lib/api-client';
import { cartSchema, type AddCartItem, type Cart } from './schema';

/**
 * Adding to the cart from the browser (FR-PDP-07, FR-PDP-08).
 *
 * Separate from `api.ts` because that module reaches for `next/headers`, which cannot appear in
 * a Client Component's module graph.
 *
 * Takes an array, because "Add selected" is **one action** (DoD §13.3). A loop over a
 * single-item call would be several requests wearing one button, and its failure mode is a
 * half-filled cart the customer has no way to reason about.
 */
export async function addCartItems(items: readonly AddCartItem[]): Promise<Cart> {
  return apiFetch('/cart/items', {
    schema: cartSchema,
    method: 'POST',
    body: { items },
  });
}
