'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';

/**
 * The cart's sticky summary on mobile (FR-CART-05): the total and the way forward, pinned above
 * the tab bar so neither scrolls away. Desktop has the sticky sidebar instead.
 */
interface MobileCheckoutBarProps {
  totalIdr: number;
  selectedQuantity: number;
  isPending: boolean;
}

export function MobileCheckoutBar({ totalIdr, selectedQuantity, isPending }: MobileCheckoutBarProps) {
  const router = useRouter();

  return (
    <div
      // Above the tab bar and padded for the home indicator, like the product page's bar.
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-frame-700 bg-frame-900 p-3 lg:hidden"
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex flex-col transition-opacity duration-fast ease-out', isPending && 'opacity-60')}>
          <span className="text-xs text-frame-muted">
            Total ({selectedQuantity} {selectedQuantity === 1 ? 'item' : 'items'})
          </span>
          <span className="font-display text-lg font-semibold tabular-nums text-white">{formatIdr(totalIdr)}</span>
        </div>

        <Button
          onClick={() => router.push('/checkout')}
          disabled={selectedQuantity === 0}
          disabledReason="Select an item to check out"
          className="flex-1"
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}
