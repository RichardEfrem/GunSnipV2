'use client';

import { Check } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { formatIdr } from '@/lib/formatters';
import type { AddStatus } from '@/features/cart/hooks/use-add-to-cart';

/**
 * The mobile purchase bar (FR-PDP-13, DESIGN.md §3.5) — appears once the main buy block has
 * scrolled out of view.
 *
 * `IntersectionObserver` on the block itself rather than a scroll listener with a pixel
 * threshold: the block's height varies with the variant selector, so any fixed offset would be
 * wrong on some products. This asks the question that is actually being asked — "can they still
 * see the buttons?" — and costs nothing per scroll frame.
 *
 * A `useEffect` here is not a data fetch (CLAUDE.md): it is a subscription to a browser API,
 * which is exactly what effects are for.
 */
interface StickyPurchaseBarProps {
  /** The buy block whose visibility decides whether this bar shows. */
  anchorRef: RefObject<HTMLElement | null>;
  priceIdr: number;
  isOutOfStock: boolean;
  status: AddStatus;
  onAdd: () => void;
}

export function StickyPurchaseBar({
  anchorRef,
  priceIdr,
  isOutOfStock,
  status,
  onAdd,
}: StickyPurchaseBarProps) {
  const [isAnchorVisible, setIsAnchorVisible] = useState(true);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsAnchorVisible(entry?.isIntersecting ?? true),
      { threshold: 0 },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorRef]);

  // Nothing to offer on an out-of-stock product, and nothing to add while the real buttons are
  // still on screen.
  if (isOutOfStock || isAnchorVisible) return null;

  return (
    <div
      // Sits above the mobile tab bar and carries the same safe-area padding, so it clears the
      // home indicator rather than sitting under it (DESIGN.md §3.5).
      className="enter-rise fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-frame-700 bg-frame-900 p-3 md:hidden"
    >
      <div className="flex items-center gap-3">
        <p className="font-display text-lg font-semibold tabular-nums text-white">
          {formatIdr(priceIdr)}
        </p>

        <Button onClick={onAdd} isLoading={status === 'adding'} className="flex-1">
          {status === 'added' ? (
            <>
              <Check className="size-4" aria-hidden />
              Added
            </>
          ) : (
            'Add to cart'
          )}
        </Button>
      </div>
    </div>
  );
}
