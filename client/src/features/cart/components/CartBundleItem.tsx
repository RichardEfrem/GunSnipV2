'use client';

import { CircleAlert, Package, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { MAX_QUANTITY_PER_LINE } from '@gunsnip/shared';
import { Checkbox } from '@/components/ui/Checkbox';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import { bundleMaxQuantity, isBundlePurchasable, isBundleSelected } from '../group-lines';
import type { CartLine, CartLineBundle } from '../schema';
import { CartLineNotices } from './CartLineNotices';

/**
 * A bundle in the cart, as the one line the customer chose (FR-CAT-11).
 *
 * Its components are listed underneath without prices of their own. They *have* prices — the
 * bundle's price is spread across them on the server, because stock and orders are per variant —
 * but showing them would invite the reader to add them up and find a different number from the
 * one they are paying. What the line owes them is the bundle's price and what is in it.
 *
 * Every control acts on the group, matching what the server does: the checkbox selects all the
 * components, the stepper counts bundles rather than items, and Remove takes the whole thing out.
 */
interface CartBundleItemProps {
  bundle: CartLineBundle;
  lines: readonly CartLine[];
  error: string | null;
  onQuantityChange: (quantity: number) => void;
  onSelectedChange: (isSelected: boolean) => void;
  onRemove: () => void;
}

export function CartBundleItem({
  bundle,
  lines,
  error,
  onQuantityChange,
  onSelectedChange,
  onRemove,
}: CartBundleItemProps) {
  const isPurchasable = isBundlePurchasable(lines);
  const isSelected = isBundleSelected(lines) && isPurchasable;
  const max = Math.max(1, Math.min(bundleMaxQuantity(bundle, lines), MAX_QUANTITY_PER_LINE));
  const href = `/bundles/${bundle.slug}`;

  return (
    <li className="flex gap-3 p-4">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelectedChange}
        disabled={!isPurchasable}
        label={<span className="sr-only">Include {bundle.name} in the total</span>}
        className="min-h-0 shrink-0 self-start pt-0.5"
      />

      <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
        <Thumbnail
          src={lines[0]?.image?.url ?? null}
          blurDataUrl={lines[0]?.image?.blurDataUrl}
          size={80}
          isDimmed={!isPurchasable}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-core-blue">
              <Package className="size-3" aria-hidden />
              Bundle
            </span>
            <Link
              href={href}
              className="reticle line-clamp-2 rounded-sm font-display text-base font-semibold leading-tight hover:text-core-blue"
            >
              {bundle.name}
            </Link>
          </div>

          <p
            className={cn(
              'shrink-0 font-display text-base font-semibold tabular-nums',
              !isSelected && 'text-frame-300',
            )}
          >
            {formatIdr(bundle.groupTotalIdr)}
          </p>
        </div>

        <div className="flex flex-wrap items-baseline gap-2">
          <Price amountIdr={bundle.unitPriceIdr} size="sm" />
          {bundle.savingIdr > 0 ? (
            <span className="text-xs font-medium text-success">Saves {formatIdr(bundle.savingIdr)}</span>
          ) : null}
        </div>

        {/* What is in it. A plain list: the components are what the customer is checking, and a
            second column of prices here would contradict the one price above. */}
        <ul className="flex flex-col gap-0.5 text-xs text-frame-300">
          {lines.map((line) => (
            <li key={line.id} className="flex gap-1.5">
              <span aria-hidden>·</span>
              <span className="min-w-0 flex-1">
                {line.quantity} × {line.productName}
                {line.variantName === null ? null : ` — ${line.variantName}`}
              </span>
            </li>
          ))}
        </ul>

        {/* A component that ran short is what stops the bundle, so its notice belongs here. */}
        {lines.map((line) => (
          <CartLineNotices key={line.id} line={line} />
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <QuantityStepper
            value={bundle.quantity}
            onChange={onQuantityChange}
            max={max}
            label={bundle.name}
            disabled={!isPurchasable}
          />

          <button
            type="button"
            onClick={onRemove}
            className="reticle inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm text-frame-300 transition-colors duration-fast ease-out hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
            <span className="sr-only"> {bundle.name}</span>
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
