import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { CART_TARGET_ATTRIBUTE } from '@/features/cart/cart-arc';

/**
 * The cart affordance and its count (DESIGN.md §4.1).
 *
 * The badge pops 1 → 1.15 → 1 whenever the count changes — half of the add-to-cart signature
 * (DESIGN.md §2.4). Keying the badge on the count is what restarts the animation: a new count
 * is a new element, so the animation replays without an effect watching for changes. Reduced
 * motion cancels it in globals.css.
 */
interface CartButtonProps {
  count: number;
}

export function CartButton({ count }: CartButtonProps) {
  return (
    <Link
      href="/cart"
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

      <span className="sr-only">
        {count === 0 ? 'Cart, empty' : `Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      </span>
    </Link>
  );
}
