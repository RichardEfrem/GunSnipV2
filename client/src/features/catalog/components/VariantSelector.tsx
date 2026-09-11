'use client';

import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import type { ProductDetail } from '../schema';

type Variant = ProductDetail['variants'][number];

/**
 * Choosing a variant (FR-PDP-04).
 *
 * **Unavailable combinations are disabled, never silently missing.** A variant that vanishes
 * when it sells out makes the product look like it never had that colour, and the customer
 * cannot tell the difference between "we don't make it" and "we're out". So an out-of-stock
 * variant stays on screen, marked, and says why when focused.
 *
 * `aria-disabled` rather than `disabled`, so it keeps its place in the tab order and a screen
 * reader can reach the explanation (DESIGN.md §4.2).
 */
interface VariantSelectorProps {
  variants: readonly Variant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
}

export function VariantSelector({ variants, selectedId, onSelect }: VariantSelectorProps) {
  // A single unnamed variant is not a choice, and rendering a one-option picker for it is noise.
  if (variants.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <p id="variant-label" className="font-display text-sm font-semibold">
        Options
      </p>

      <div role="radiogroup" aria-labelledby="variant-label" className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isOut = variant.availableQuantity <= 0;
          const isSelected = variant.id === selectedId;

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isOut || undefined}
              tabIndex={isSelected ? 0 : -1}
              title={isOut ? 'Out of stock' : undefined}
              onClick={isOut ? undefined : () => onSelect(variant.id)}
              className={cn(
                'reticle flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-sm border px-3 py-1.5 text-left transition-colors duration-fast ease-out',
                isSelected ? 'border-core-blue bg-core-blue-tint' : 'border-field-border hover:border-core-blue',
                isOut && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="font-display text-sm font-semibold">{label(variant)}</span>
              <span className="text-xs tabular-nums text-frame-300">
                {formatIdr(variant.priceIdr)}
                {isOut ? ' · Out of stock' : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * `optionValues` is the truthful label — `{ colour: 'Mr. Color 8 Silver' }` reads better than a
 * variant name that repeats the product's. The name and then the SKU are fallbacks for rows
 * that carry no options.
 */
function label(variant: Variant): string {
  const options = Object.values(variant.optionValues);

  if (options.length > 0) return options.join(' · ');
  return variant.name ?? variant.sku;
}
