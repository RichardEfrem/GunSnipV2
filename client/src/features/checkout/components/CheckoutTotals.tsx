import { voucherRejectionText } from '@/features/cart/voucher-copy';
import { cn } from '@/lib/cn';
import { formatDeliveryPromise, formatIdr } from '@/lib/formatters';
import { SHIPPING_TIER_LABELS } from '@/lib/labels';
import type { CheckoutQuote } from '../schema';

/**
 * Subtotal, voucher, shipping, total (FR-CO-05) — the server's figures, rendered, never summed
 * here (CLAUDE.md non-negotiable #2). While a re-quote is on its way the figures dim rather than
 * guess; the sidebar and the mobile panel both draw this.
 */
interface CheckoutTotalsProps {
  quote: CheckoutQuote;
  isPending: boolean;
}

export function CheckoutTotals({ quote, isPending }: CheckoutTotalsProps) {
  const { totals, voucher, delivery } = quote;
  const selected = delivery?.selected ?? null;

  return (
    <dl className={cn('flex flex-col gap-2 text-sm tabular-nums transition-opacity duration-fast ease-out', isPending && 'opacity-60')}>
      <Row label={`Subtotal (${totals.itemCount} ${totals.itemCount === 1 ? 'item' : 'items'})`} value={formatIdr(totals.subtotalIdr)} />

      {voucher === null ? null : voucher.isApplied ? (
        <Row label={`Voucher ${voucher.code}`} value={`− ${formatIdr(totals.discountIdr)}`} />
      ) : (
        <div className="flex flex-col gap-0.5">
          <Row label={`Voucher ${voucher.code}`} value="Not applied" />
          {voucher.rejection === null ? null : (
            <p className="text-xs text-warn">{voucherRejectionText(voucher.code, voucher.rejection)}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <Row
          label="Shipping"
          value={selected === null ? (delivery === null ? 'Add an address' : 'Unavailable') : formatIdr(totals.shippingIdr)}
        />
        {selected === null ? null : (
          <p className="text-xs text-frame-300">
            {SHIPPING_TIER_LABELS[selected.tier]} · {formatDeliveryPromise(selected.minDays, selected.maxDays)}
          </p>
        )}
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-armor-150 pt-3">
        <dt className="font-display text-base font-semibold">Total</dt>
        <dd className="font-display text-2xl font-semibold text-sortie-red">{formatIdr(totals.totalIdr)}</dd>
      </div>
      {selected === null ? <p className="text-xs text-frame-300">Shipping is added once you choose an address.</p> : null}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-frame-300">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
