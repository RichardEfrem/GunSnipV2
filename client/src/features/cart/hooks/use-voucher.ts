'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { applyVoucher, removeVoucher } from '../client-api';
import { voucherErrorMessage } from '../error-message';

/**
 * Applying and removing the cart's voucher (FR-CART-06).
 *
 * Not optimistic: whether a code applies is the whole question, and only the server can answer
 * it. The button shows it is working, and the answer is either the refreshed summary with the
 * discount in it or a reason under the field saying what to do instead.
 */
export interface UseVoucher {
  isPending: boolean;
  /** Why the last code was rejected, worded for the customer. */
  error: string | null;
  apply: (code: string) => void;
  remove: () => void;
  clearError: () => void;
}

export function useVoucher(): UseVoucher {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (code: string) => {
      const normalised = code.trim().toUpperCase();

      if (normalised === '') {
        setError('Enter a voucher code.');
        return;
      }

      setError(null);

      startTransition(async () => {
        try {
          await applyVoucher(normalised);
        } catch (cause) {
          setError(voucherErrorMessage(normalised, cause));
          return;
        }

        router.refresh();
      });
    },
    [router],
  );

  const remove = useCallback(() => {
    setError(null);

    startTransition(async () => {
      try {
        await removeVoucher();
      } catch (cause) {
        setError(voucherErrorMessage('', cause));
        return;
      }

      router.refresh();
    });
  }, [router]);

  return { isPending, error, apply, remove, clearError: () => setError(null) };
}
