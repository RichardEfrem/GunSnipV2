'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useOptimistic, useRef, useState, useTransition } from 'react';
import {
  removeCartLine,
  removeSelectedCartLines,
  setAllCartLinesSelected,
  updateCartLine,
} from '../client-api';
import { cartErrorMessage } from '../error-message';
import type { Cart, CartLine } from '../schema';

/**
 * Every change the cart page makes to its lines (FR-CART-02, FR-CART-03).
 *
 * **Optimistic for the control, never for the money.** A ticked checkbox or a stepped quantity
 * shows immediately, because a checkbox that lags reads as a checkbox that did not work. The
 * totals do not move until the server has priced the new cart (CLAUDE.md non-negotiable #2) —
 * the summary shows it is updating instead (`isPending`), and then shows the server's figures.
 *
 * The server tree is re-rendered with `router.refresh()` rather than patched from the response,
 * for the same reason as `use-add-to-cart.ts`: the header badge, the mini-cart and this page all
 * read the one cart the server renders, and a client copy is how they would come to disagree.
 * The refresh runs inside the transition, so the optimistic value is held until the refreshed
 * lines arrive to replace it — there is no moment where the old value flashes back.
 */
type OptimisticChange =
  | { type: 'quantity'; lineId: string; quantity: number }
  | { type: 'select'; lineId: string; isSelected: boolean }
  | { type: 'selectAll'; isSelected: boolean }
  | { type: 'remove'; lineIds: ReadonlySet<string> };

function applyChange(lines: readonly CartLine[], change: OptimisticChange): readonly CartLine[] {
  switch (change.type) {
    case 'quantity':
      return lines.map((line) => (line.id === change.lineId ? { ...line, quantity: change.quantity } : line));
    case 'select':
      return lines.map((line) => (line.id === change.lineId ? { ...line, isSelected: change.isSelected } : line));
    case 'selectAll':
      return lines.map((line) => ({ ...line, isSelected: change.isSelected }));
    case 'remove':
      return lines.filter((line) => !change.lineIds.has(line.id));
  }
}

/** A failed change, attached to the line it was about, or to the cart when it was about all of them. */
export interface CartActionError {
  lineId: string | null;
  message: string;
}

export interface CartActions {
  lines: readonly CartLine[];
  /** True from the click until the server's re-priced cart has rendered. */
  isPending: boolean;
  error: CartActionError | null;
  setQuantity: (line: CartLine, quantity: number) => void;
  setSelected: (line: CartLine, isSelected: boolean) => void;
  setAllSelected: (isSelected: boolean) => void;
  remove: (line: CartLine) => void;
  removeSelected: () => void;
}

export function useCartActions(serverLines: readonly CartLine[]): CartActions {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lines, applyOptimistic] = useOptimistic(serverLines, applyChange);
  const [error, setError] = useState<CartActionError | null>(null);

  // Requests run one at a time, in click order. Three quick taps on "+" send 2, 3, 4; without the
  // queue they race, and a "3" arriving after the "4" would leave the cart at a number the
  // customer never chose.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = useCallback(
    (change: OptimisticChange, request: () => Promise<Cart>, lineId: string | null) => {
      setError(null);

      startTransition(async () => {
        applyOptimistic(change);

        const result = queue.current.then(request);
        queue.current = result.catch(() => undefined);

        try {
          await result;
        } catch (cause) {
          setError({ lineId, message: cartErrorMessage(cause) });
        }

        // After a failure too: the usual cause is that the cart changed underneath the page —
        // stock ran out, the line was removed in another tab — and the page should show that.
        router.refresh();
      });
    },
    [applyOptimistic, router],
  );

  return {
    lines,
    isPending,
    error,
    setQuantity: (line, quantity) =>
      run({ type: 'quantity', lineId: line.id, quantity }, () => updateCartLine(line.id, { quantity }), line.id),
    setSelected: (line, isSelected) =>
      run({ type: 'select', lineId: line.id, isSelected }, () => updateCartLine(line.id, { isSelected }), line.id),
    setAllSelected: (isSelected) =>
      run({ type: 'selectAll', isSelected }, () => setAllCartLinesSelected(isSelected), null),
    remove: (line) => run({ type: 'remove', lineIds: new Set([line.id]) }, () => removeCartLine(line.id), line.id),
    removeSelected: () =>
      run(
        {
          type: 'remove',
          // The lines the customer sees ticked — the same rule the server applies.
          lineIds: new Set(lines.filter((line) => line.isSelected && line.isPurchasable).map((line) => line.id)),
        },
        removeSelectedCartLines,
        null,
      ),
  };
}
