import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { CheckoutQuote } from '../schema';
import { CheckoutLines } from './CheckoutLines';
import { CheckoutTotals } from './CheckoutTotals';

/**
 * The order summary sidebar (FR-CO-05, DESIGN.md §3.7): what is being ordered, what it costs, and
 * the one primary action. Sticky on desktop so the total is in view at every scroll position; on
 * mobile `MobileOrderBar` carries the total and the button instead.
 */
interface CheckoutSummaryProps {
  quote: CheckoutQuote;
  isPending: boolean;
  isPlacing: boolean;
  /** Why "Place order" cannot be pressed yet, or null when it can. */
  blockedReason: string | null;
  error: string | null;
}

export function CheckoutSummary({ quote, isPending, isPlacing, blockedReason, error }: CheckoutSummaryProps) {
  return (
    <section
      aria-labelledby="checkout-summary"
      aria-busy={isPending}
      className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checkout-summary" className="text-lg">
          Order summary
        </h2>
        <Link href="/cart" className="reticle text-sm text-core-blue underline-offset-4 hover:underline">
          Edit cart
        </Link>
      </div>

      <CheckoutLines lines={quote.lines} />

      {quote.unavailableCount === 0 ? null : (
        <p className="text-xs text-frame-300">
          {quote.unavailableCount} selected {quote.unavailableCount === 1 ? 'item is' : 'items are'} out of stock and
          will stay in your cart.
        </p>
      )}

      <div className="border-t border-armor-150 pt-4">
        <CheckoutTotals quote={quote} isPending={isPending} />
      </div>

      {/* Desktop only, like the button: on mobile the bar says it, and a hidden copy is not announced. */}
      <div className="hidden flex-col gap-3 lg:flex">
        {error === null ? null : <OrderError message={error} />}

        <Button
          type="submit"
          isLoading={isPlacing}
          disabled={blockedReason !== null}
          disabledReason={blockedReason ?? undefined}
          className="w-full"
        >
          Place order
        </Button>
      </div>
    </section>
  );
}

export function OrderError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
