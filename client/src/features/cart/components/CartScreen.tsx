'use client';

import { CircleAlert } from 'lucide-react';
import { useCartActions } from '../hooks/use-cart-actions';
import type { Cart } from '../schema';
import { CartLineItem } from './CartLineItem';
import { CartSelectionBar } from './CartSelectionBar';
import { CartSummary } from './CartSummary';
import { MobileCheckoutBar } from './MobileCheckoutBar';

/**
 * The loaded cart (DESIGN.md §3.6): lines on the left, the sticky summary on the right.
 *
 * The client boundary for the page. Lines, selection and summary share one pending state — a
 * ticked line has to dim the total it is about to change — so they sit under the one hook
 * rather than each owning a request of its own. The cart itself arrives as props from the
 * server render and is replaced wholesale when that render refreshes.
 */
export function CartScreen({ cart }: { cart: Cart }) {
  const actions = useCartActions(cart.lines);
  const { lines, error } = actions;

  const purchasable = lines.filter((line) => line.isPurchasable);
  const selectedCount = purchasable.filter((line) => line.isSelected).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section aria-label="Items in your cart" className="border border-armor-150 bg-armor-000">
        <CartSelectionBar
          purchasableCount={purchasable.length}
          selectedCount={selectedCount}
          onSelectAll={actions.setAllSelected}
          onDeleteSelected={actions.removeSelected}
        />

        {error !== null && error.lineId === null ? (
          <p role="alert" className="flex items-center gap-1.5 border-b border-armor-150 px-4 py-3 text-sm text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {error.message}
          </p>
        ) : null}

        <ul className="divide-y divide-armor-150">
          {lines.map((line) => (
            <CartLineItem
              key={line.id}
              line={line}
              error={error !== null && error.lineId === line.id ? error.message : null}
              onQuantityChange={(quantity) => actions.setQuantity(line, quantity)}
              onSelectedChange={(isSelected) => actions.setSelected(line, isSelected)}
              onRemove={() => actions.remove(line)}
            />
          ))}
        </ul>
      </section>

      {/* Sticky below the header's collapsed height, so the total stays in view while the
          lines scroll (FR-CART-05). */}
      <aside className="lg:sticky lg:top-20">
        <CartSummary cart={cart} isPending={actions.isPending} />
      </aside>

      <MobileCheckoutBar
        totalIdr={cart.totals.totalIdr}
        selectedQuantity={cart.totals.selectedQuantity}
        isPending={actions.isPending}
      />
    </div>
  );
}
