'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ApiError } from '@/lib/api-error';
import { cancelOrder } from '../client-api';

/**
 * Buyer cancellation (FR-ORD-04).
 *
 * One transition covers the request and the re-render that follows, so "Cancelling" shows until
 * the page has the server's new order — status, timeline, and no cancel button, which is what
 * closes the dialog. After a refusal the page is re-rendered too: the order may have been paid or
 * cancelled elsewhere, and should show what it is now.
 */
export interface CancelOrderState {
  isCancelling: boolean;
  error: string | null;
  cancel: () => void;
}

export function useCancelOrder(orderNumber: string, email: string | undefined): CancelOrderState {
  const router = useRouter();
  const [isCancelling, startCancelling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return {
    isCancelling,
    error,
    cancel: () => {
      setError(null);

      startCancelling(async () => {
        try {
          await cancelOrder(orderNumber, email);
        } catch (cause) {
          // The API's refusal is already customer copy — "This order can no longer be cancelled…".
          setError(
            cause instanceof ApiError && cause.status > 0 && cause.status < 500
              ? cause.message
              : "Couldn't cancel the order. Try again in a moment.",
          );
        }

        router.refresh();
      });
    },
  };
}
