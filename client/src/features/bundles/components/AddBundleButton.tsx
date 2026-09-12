'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cartErrorMessage } from '@/features/cart/error-message';
import { addBundleToCart } from '../client-api';
import type { Bundle } from '../schema';

/**
 * "Add bundle to cart" (FR-CAT-11).
 *
 * Confirms inline rather than navigating, for the same reason the product page does (FR-PDP-07):
 * a customer who has just added one bundle is more likely to want another than to want the cart.
 *
 * `router.refresh()` re-renders the server tree — the header count, the cart page — instead of
 * keeping a second copy of the cart in React state that could disagree with it after a failure.
 */
const CONFIRMATION_MS = 2000;

export function AddBundleButton({ bundle }: { bundle: Bundle }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'adding' | 'added'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function add(): Promise<void> {
    setStatus('adding');
    setError(null);

    try {
      await addBundleToCart(bundle.slug);
      setStatus('added');
      router.refresh();
      setTimeout(() => setStatus('idle'), CONFIRMATION_MS);
    } catch (cause) {
      setStatus('idle');
      setError(cartErrorMessage(cause));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={add}
        isLoading={status === 'adding'}
        disabled={!bundle.isPurchasable}
        disabledReason={bundle.isPurchasable ? undefined : 'One of the items in this bundle is out of stock.'}
        className="w-full"
      >
        {status === 'added' ? (
          <>
            <Check className="size-4" aria-hidden />
            Added
          </>
        ) : (
          'Add bundle to cart'
        )}
      </Button>

      {error === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
