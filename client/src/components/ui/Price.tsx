import { cn } from '@/lib/cn';
import { discountPercent, formatIdr } from '@/lib/formatters';

/**
 * Money (DESIGN.md §3.4). Red is reserved for commerce, so this is one of the few places it
 * appears at all. Tabular figures keep prices aligned down a grid column.
 */
const SIZES = {
  sm: { price: 'text-base', compare: 'text-xs' },
  md: { price: 'text-lg', compare: 'text-sm' },
  lg: { price: 'text-2xl', compare: 'text-base' },
} as const;

interface PriceProps {
  /** Whole rupiah, as stored (PRD A2). */
  amountIdr: number;
  /** The struck-through original. Renders only when it is genuinely higher. */
  compareAtIdr?: number | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Price({ amountIdr, compareAtIdr = null, size = 'md', className }: PriceProps) {
  const sizes = SIZES[size];
  const percentOff = discountPercent(amountIdr, compareAtIdr);

  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 font-display tabular-nums', className)}>
      <span className={cn('font-semibold text-sortie-red', sizes.price)}>{formatIdr(amountIdr)}</span>

      {percentOff === null || compareAtIdr === null ? null : (
        <s className={cn('text-frame-300', sizes.compare)}>
          {/* Without this a screen reader reads two prices in a row with no relationship. */}
          <span className="sr-only">Was </span>
          {formatIdr(compareAtIdr)}
        </s>
      )}
    </p>
  );
}
