'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import { CART_TARGET_ATTRIBUTE } from '../cart-arc';
import { noticeText } from '../notice-copy';
import type { Cart } from '../schema';
import { Thumbnail } from '@/components/ui/Thumbnail';

/**
 * The header's cart: the icon with its count, opening a drawer that shows the cart without
 * leaving the page (FR-CART-09, DESIGN.md §4.1).
 *
 * Read-only on purpose. Editing belongs on the cart page, where the summary, the notices and the
 * voucher sit together; a second, smaller editor here would be a second place for them to
 * disagree. The drawer answers "what's in it and what does it come to", then offers the way on.
 *
 * The badge pops 1 → 1.15 → 1 whenever the count changes — half of the add-to-cart signature
 * (DESIGN.md §2.4). Keying it on the count restarts the animation without an effect watching for
 * changes. Reduced motion cancels it in globals.css.
 */
export function MiniCart({ cart }: { cart: Cart | null }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const count = cart?.totals.lineCount ?? 0;
  const items = `${count} ${count === 1 ? 'item' : 'items'}`;

  function go(href: string) {
    setIsOpen(false);
    router.push(href);
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={setIsOpen}
      side="right"
      title={count === 0 ? 'Cart' : `Cart (${items})`}
      trigger={
        <button
          type="button"
          // Where the add-to-cart arc lands (DESIGN.md §2.4).
          {...{ [CART_TARGET_ATTRIBUTE]: '' }}
          className="reticle relative grid size-11 place-items-center rounded-sm text-white transition-colors duration-fast ease-out hover:text-core-blue"
        >
          <ShoppingCart className="size-5" aria-hidden />

          {count > 0 ? (
            <span
              key={count}
              className="badge-pop absolute right-0.5 top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red-fill px-1 font-display text-xs font-semibold tabular-nums text-white"
              aria-hidden
            >
              {count}
            </span>
          ) : null}

          <span className="sr-only">{count === 0 ? 'Cart, empty' : `Cart, ${items}`}</span>
        </button>
      }
      footer={
        cart === null || count === 0 ? undefined : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-frame-300">
                Subtotal ({cart.totals.selectedQuantity} selected)
              </span>
              <span className="font-display text-lg font-semibold tabular-nums text-sortie-red">
                {formatIdr(cart.totals.subtotalIdr)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link href="/cart" onClick={() => setIsOpen(false)} className={buttonStyles('secondary')}>
                View cart
              </Link>
              <Button
                onClick={() => go('/checkout')}
                disabled={cart.totals.selectedQuantity === 0}
                disabledReason="Select an item in your cart to check out"
              >
                Checkout
              </Button>
            </div>
          </div>
        )
      }
    >
      {cart === null || count === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Kits you add land here, with the tools they need to build."
          action={
            <Link href="/kits" onClick={() => setIsOpen(false)} className={buttonStyles('secondary')}>
              Browse kits
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-armor-150">
          {cart.lines.map((line) => {
            const isCounted = line.isSelected && line.isPurchasable;
            const firstNotice = line.notices[0];

            return (
              <li key={line.id} className="flex gap-3 py-3 first:pt-0">
                <Thumbnail src={line.image?.url ?? null} blurDataUrl={line.image?.blurDataUrl} size={48} isDimmed={!line.isPurchasable} />

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={`/products/${line.productSlug}`}
                    onClick={() => setIsOpen(false)}
                    className="reticle line-clamp-2 rounded-sm text-sm font-medium hover:text-core-blue"
                  >
                    {line.productName}
                  </Link>

                  <p className={cn('text-xs tabular-nums', isCounted ? 'text-ink' : 'text-frame-300')}>
                    {line.quantity} × {formatIdr(line.unitPriceIdr)}
                    {isCounted ? null : line.isPurchasable ? ' · not selected' : null}
                  </p>

                  {firstNotice === undefined ? null : (
                    <p className="text-xs text-warn">{noticeText(firstNotice, line)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
