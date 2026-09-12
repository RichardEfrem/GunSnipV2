'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatIdr } from '@/lib/formatters';
import type { Cart } from '../schema';
import { shippingEstimateText } from '../shipping-copy';
import { VoucherForm } from './VoucherForm';

/**
 * The order summary (FR-CART-05, DESIGN.md §3.6): subtotal, voucher, shipping estimate, total.
 *
 * Every figure is the server's. While a change is being priced the figures dim and the region is
 * marked busy rather than being recomputed here — a total the browser worked out is a total the
 * browser could get wrong (CLAUDE.md non-negotiable #2).
 *
 * The checkout button is desktop-only; on mobile the sticky bar carries it, so there is one
 * primary action per view (DESIGN.md §4.2).
 */
interface CartSummaryProps {
  cart: Cart;
  isPending: boolean;
}

export function CartSummary({ cart, isPending }: CartSummaryProps) {
  const router = useRouter();
  const { totals, voucher, shippingEstimate } = cart;
  const hasSelection = totals.selectedQuantity > 0;

  return (
    <section
      aria-labelledby="order-summary"
      aria-busy={isPending}
      className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4"
    >
      <h2 id="order-summary" className="text-lg">
        Order summary
      </h2>

      <dl
        className={cn(
          'flex flex-col gap-2 text-sm tabular-nums transition-opacity duration-fast ease-out',
          isPending && 'opacity-60',
        )}
      >
        <SummaryRow
          label={`Subtotal (${totals.selectedQuantity} ${totals.selectedQuantity === 1 ? 'item' : 'items'})`}
          value={formatIdr(totals.subtotalIdr)}
        />

        {totals.discountIdr > 0 && voucher !== null ? (
          <SummaryRow label={`Voucher ${voucher.code}`} value={`− ${formatIdr(totals.discountIdr)}`} />
        ) : null}

        {shippingEstimate === null ? null : (
          <div className="flex flex-col gap-0.5">
            <SummaryRow
              label="Shipping (est.)"
              value={hasSelection ? formatIdr(totals.shippingIdr) : `from ${formatIdr(shippingEstimate.priceIdr)}`}
            />
            <p className="text-xs text-frame-300">{shippingEstimateText(shippingEstimate)}</p>
          </div>
        )}

        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-armor-150 pt-3">
          <dt className="font-display text-base font-semibold">Total</dt>
          <dd className="font-display text-2xl font-semibold text-sortie-red">{formatIdr(totals.totalIdr)}</dd>
        </div>
      </dl>

      {/* Announces the settled total once a change has been priced (DESIGN.md §6). */}
      <p className="sr-only" role="status" aria-live="polite">
        {isPending ? '' : `Total ${formatIdr(totals.totalIdr)}`}
      </p>

      <VoucherForm voucher={voucher} />

      <Button
        onClick={() => router.push('/checkout')}
        disabled={!hasSelection}
        disabledReason="Select an item to check out"
        className="hidden w-full lg:inline-flex"
      >
        Checkout
      </Button>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-frame-300">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
