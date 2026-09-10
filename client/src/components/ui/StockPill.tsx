import type { StockState } from '@gunsnip/shared';
import { cn } from '@/lib/cn';

/**
 * Stock state as a dot plus a word (DESIGN.md §3.4).
 *
 * The word is not decoration: colour is never the only signal (DESIGN.md §6), and a card that
 * omits stock state costs a click every time the item is out.
 */
const TONES: Record<StockState, string> = {
  IN_STOCK: 'text-ok',
  LOW_STOCK: 'text-warn',
  OUT_OF_STOCK: 'text-frame-300',
  PREORDER: 'text-core-blue',
};

interface StockPillProps {
  state: StockState;
  /**
   * Units available. Supplied on the product page, where "8 left" beats "Almost gone"
   * (DESIGN.md §5) — omitted on cards, where the exact number is noise.
   */
  availableQuantity?: number;
  className?: string;
}

function label(state: StockState, availableQuantity: number | undefined): string {
  switch (state) {
    case 'IN_STOCK':
      return availableQuantity === undefined ? 'In stock' : `In stock — ${availableQuantity} left`;
    case 'LOW_STOCK':
      return availableQuantity === undefined ? 'Low stock' : `Only ${availableQuantity} left`;
    case 'OUT_OF_STOCK':
      return 'Out of stock';
    case 'PREORDER':
      return 'Preorder';
  }
}

export function StockPill({ state, availableQuantity, className }: StockPillProps) {
  return (
    <p className={cn('flex items-center gap-1.5 text-xs', TONES[state], className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {label(state, availableQuantity)}
    </p>
  );
}
