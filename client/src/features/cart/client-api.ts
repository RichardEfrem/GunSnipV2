import { apiFetch } from '@/lib/api-client';
import { cartSchema, type AddCartItem, type Cart, type CartLineChange } from './schema';

/**
 * Changing the cart from the browser (FR-PDP-07, FR-PDP-08, FR-CART-02 … FR-CART-06).
 *
 * Separate from `api.ts` because that module reaches for `next/headers`, which cannot appear in
 * a Client Component's module graph.
 *
 * Every call returns the whole cart, parsed. Callers mostly ignore it and re-render the server
 * tree instead (see `use-cart-actions.ts`), but parsing it still matters: a response that does
 * not match the schema fails here, loudly, rather than being trusted.
 */

/**
 * Takes an array, because "Add selected" is **one action** (DoD §13.3). A loop over a
 * single-item call would be several requests wearing one button, and its failure mode is a
 * half-filled cart the customer has no way to reason about.
 */
export async function addCartItems(items: readonly AddCartItem[]): Promise<Cart> {
  return apiFetch('/cart/items', { schema: cartSchema, method: 'POST', body: { items } });
}

export async function updateCartLine(lineId: string, change: CartLineChange): Promise<Cart> {
  return apiFetch(`/cart/items/${encodeURIComponent(lineId)}`, {
    schema: cartSchema,
    method: 'PATCH',
    body: change,
  });
}

export async function setAllCartLinesSelected(isSelected: boolean): Promise<Cart> {
  return apiFetch('/cart/items', { schema: cartSchema, method: 'PATCH', body: { isSelected } });
}

export async function removeCartLine(lineId: string): Promise<Cart> {
  return apiFetch(`/cart/items/${encodeURIComponent(lineId)}`, { schema: cartSchema, method: 'DELETE' });
}

export async function removeSelectedCartLines(): Promise<Cart> {
  return apiFetch('/cart/items/selected', { schema: cartSchema, method: 'DELETE' });
}

export async function applyVoucher(code: string): Promise<Cart> {
  return apiFetch('/cart/voucher', { schema: cartSchema, method: 'POST', body: { code } });
}

export async function removeVoucher(): Promise<Cart> {
  return apiFetch('/cart/voucher', { schema: cartSchema, method: 'DELETE' });
}
