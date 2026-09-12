'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { clearDraftCookie } from '../draft-cookie';
import { placeOrder, type PlaceOrderBody } from '../client-api';
import { isOutcomeUnknown, isStaleCheckout, orderErrorMessage } from '../order-error-message';

/**
 * "Place order" (FR-CO-07, DoD §13.5).
 *
 * Two guards against a double order, one on each side of the wire:
 *
 * - **Here**, a second press while the first is in flight does nothing — the button shows its
 *   spinner, and the ref below refuses re-entry even before React has re-rendered it.
 * - **On the server**, every attempt carries an `Idempotency-Key`. The key is kept when the
 *   outcome is unknown — a dropped connection, a 5xx — so pressing again replays the same request
 *   and gets the order that may already exist. A definite refusal retires the key, because the
 *   corrected request that follows is a different attempt.
 */
export interface PlaceOrderState {
  isPlacing: boolean;
  error: string | null;
  place: (body: PlaceOrderBody) => Promise<void>;
}

export function usePlaceOrder(): PlaceOrderState {
  const router = useRouter();
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const attemptKey = useRef<string | null>(null);

  async function place(body: PlaceOrderBody): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;

    attemptKey.current ??= crypto.randomUUID();
    setIsPlacing(true);
    setError(null);

    try {
      const order = await placeOrder(body, attemptKey.current);

      clearDraftCookie();
      router.push(`/orders/${order.orderNumber}`);
      // The header's cart badge lives in a layout the navigation keeps, so it is refreshed too.
      router.refresh();
      // Left "placing" on purpose: the page is leaving, and a button that re-enabled for the
      // moment before it goes would invite a second order.
    } catch (cause) {
      if (!isOutcomeUnknown(cause)) attemptKey.current = null;

      setError(orderErrorMessage(cause));
      setIsPlacing(false);
      inFlight.current = false;

      // The cart, a price or the stock moved: redraw the summary so what the customer checks
      // before trying again is what the server now says.
      if (isStaleCheckout(cause)) router.refresh();
    }
  }

  return { isPlacing, error, place };
}
