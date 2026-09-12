'use client';

import { CircleAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';
import { Checkbox } from '@/components/ui/Checkbox';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { StockPill } from '@/components/ui/StockPill';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import type { CartLine } from '../schema';
import { CartLineNotices } from './CartLineNotices';
import { Thumbnail } from '@/components/ui/Thumbnail';

/**
 * One cart line (FR-CART-02): image, name, variant, unit price, quantity stepper, line total,
 * remove — and the checkbox that decides whether it counts (FR-CART-03).
 *
 * A line that cannot be bought keeps its place in the cart, dimmed, with its checkbox and
 * stepper removed from use and a notice saying why. It can still be removed.
 */
interface CartLineItemProps {
  line: CartLine;
  /** Why the last change to this line failed, worded for the customer. */
  error: string | null;
  onQuantityChange: (quantity: number) => void;
  onSelectedChange: (isSelected: boolean) => void;
  onRemove: () => void;
}

export function CartLineItem({ line, error, onQuantityChange, onSelectedChange, onRemove }: CartLineItemProps) {
  const href = `/products/${line.productSlug}`;
  // Bounded by stock and by the per-line cap, whichever is lower (FR-PDP-06).
  const max = Math.max(1, Math.min(line.availableQuantity, MAX_QUANTITY_PER_LINE));

  return (
    <li className="flex gap-3 p-4">
      <Checkbox
        checked={line.isSelected && line.isPurchasable}
        onCheckedChange={onSelectedChange}
        disabled={!line.isPurchasable}
        label={<span className="sr-only">Include {line.productName} in the total</span>}
        className="min-h-0 shrink-0 self-start pt-0.5"
      />

      {/* Out of the tab order and hidden from assistive tech: the name below is the same link,
          and one kit should be one stop for a keyboard or a screen reader. */}
      <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
        <Thumbnail src={line.image?.url ?? null} blurDataUrl={line.image?.blurDataUrl} size={80} isDimmed={!line.isPurchasable} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={href}
              className="reticle line-clamp-2 rounded-sm font-display text-base font-semibold leading-tight hover:text-core-blue"
            >
              {line.productName}
            </Link>
            {line.variantName === null ? null : <p className="text-xs text-frame-300">{line.variantName}</p>}
          </div>

          {/* The line's contribution, as the server priced it. Dimmed while outside the total,
              so an unticked line cannot be misread as counted. */}
          <p
            className={cn(
              'shrink-0 font-display text-base font-semibold tabular-nums',
              !(line.isSelected && line.isPurchasable) && 'text-frame-300',
            )}
          >
            {formatIdr(line.lineTotalIdr)}
          </p>
        </div>

        <Price amountIdr={line.unitPriceIdr} size="sm" />

        {/* "Only 2 left", unless the reduction notice below is already saying so. */}
        {line.stockState === 'LOW_STOCK' &&
        line.isPurchasable &&
        !line.notices.some((notice) => notice.kind === 'QUANTITY_REDUCED') ? (
          <StockPill state="LOW_STOCK" availableQuantity={line.availableQuantity} />
        ) : null}

        <CartLineNotices line={line} />

        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper
            value={line.quantity}
            onChange={onQuantityChange}
            max={max}
            label={line.productName}
            disabled={!line.isPurchasable}
          />

          <button
            type="button"
            onClick={onRemove}
            className="reticle inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm text-frame-300 transition-colors duration-fast ease-out hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
            <span className="sr-only"> {line.productName}</span>
          </button>
        </div>

        {error === null ? null : (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
