'use client';

import { ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import type { CheckoutQuote } from '../schema';
import { OrderError } from './CheckoutSummary';
import { CheckoutTotals } from './CheckoutTotals';

/**
 * The summary on mobile (FR-CO-05, DESIGN.md §3.7): a collapsible panel pinned above the tab bar.
 * Collapsed it is the total and "Place order", so the total is visible at every scroll position;
 * expanded it is the full breakdown. Desktop has the sticky sidebar instead.
 */
interface MobileOrderBarProps {
  quote: CheckoutQuote;
  isPending: boolean;
  isPlacing: boolean;
  blockedReason: string | null;
  error: string | null;
}

export function MobileOrderBar({ quote, isPending, isPlacing, blockedReason, error }: MobileOrderBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
      <div id={panelId} hidden={!isOpen} className="max-h-[50dvh] overflow-y-auto border-t border-armor-150 bg-armor-000 p-4 shadow-float">
        <CheckoutTotals quote={quote} isPending={isPending} />
      </div>

      <div className="flex flex-col gap-2 border-t border-frame-700 bg-frame-900 p-3">
        {error === null ? null : (
          <div className="rounded-sm bg-armor-000 p-2">
            <OrderError message={error} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setIsOpen((open) => !open)}
            className={cn('reticle flex min-h-11 flex-col items-start text-left transition-opacity duration-fast ease-out', isPending && 'opacity-60')}
          >
            <span className="flex items-center gap-1 text-xs text-frame-muted">
              {isOpen ? 'Hide' : 'Show'} summary
              <ChevronUp className={cn('size-3.5 transition-transform duration-fast', !isOpen && 'rotate-180')} aria-hidden />
            </span>
            <span className="font-display text-lg font-semibold tabular-nums text-white">{formatIdr(quote.totals.totalIdr)}</span>
          </button>

          <Button
            type="submit"
            isLoading={isPlacing}
            disabled={blockedReason !== null}
            disabledReason={blockedReason ?? undefined}
            className="flex-1"
          >
            Place order
          </Button>
        </div>
      </div>
    </div>
  );
}
