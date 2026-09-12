'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { addCartItems } from '../client-api';
import { cartErrorMessage } from '../error-message';
import { flyToCart } from '../cart-arc';
import type { AddCartItem } from '../schema';

/**
 * Adding to the cart from a Client Component (FR-PDP-07, FR-PDP-08).
 *
 * Owns the whole interaction so no component has to: the request, the signature arc, the
 * inline confirmation that FR-PDP-07 requires *instead of* a navigation, and the refresh that
 * re-renders the server tree with the new cart.
 *
 * `router.refresh()` rather than a client-side cart mirror. The cart the server already renders
 * — the header badge, the "Already in cart" rows — is the single source of truth, and keeping a
 * second copy in React state is how the two come to disagree after a failed request.
 */
export type AddStatus = 'idle' | 'adding' | 'added' | 'error';

interface UseAddToCart {
  status: AddStatus;
  /** A message fit to show a customer. Null unless `status` is `error`. */
  error: string | null;
  /**
   * Resolves `true` once the items are in the cart. Never rejects — a failure is already on
   * screen through `error` — so the boolean is how a caller knows whether to carry on: "Buy now"
   * must not navigate to a cart the item never reached.
   */
  add: (items: readonly AddCartItem[]) => Promise<boolean>;
}

/** How long the inline "Added" confirmation stays up before the button returns to normal. */
const CONFIRMATION_MS = 2000;

/**
 * @param flyFrom Resolves the element the signature arc launches from, called at add time so it
 *   sees wherever the gallery has scrolled to. Omit it for a control with no single image to
 *   throw — "Add selected" covers several products at once, and picking one of them to animate
 *   would misrepresent what just happened.
 */
export function useAddToCart(flyFrom?: () => HTMLElement | null): UseAddToCart {
  const router = useRouter();
  const [status, setStatus] = useState<AddStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (items: readonly AddCartItem[]) => {
      if (items.length === 0) return false;

      setStatus('adding');
      setError(null);

      try {
        await addCartItems(items);
      } catch (cause) {
        setStatus('error');
        setError(cartErrorMessage(cause));
        return false;
      }

      // Fired after the write succeeds, so the part never flies for an item that did not land.
      flyToCart(flyFrom?.() ?? null);

      setStatus('added');
      // Re-reads the cart on the server: the header badge, and any "Already in cart" row.
      router.refresh();

      window.setTimeout(() => {
        // Guards against clobbering a newer interaction's state — a second add that is already
        // in flight owns the status by the time this fires.
        setStatus((current) => (current === 'added' ? 'idle' : current));
      }, CONFIRMATION_MS);

      return true;
    },
    [flyFrom, router],
  );

  return { status, error, add };
}
