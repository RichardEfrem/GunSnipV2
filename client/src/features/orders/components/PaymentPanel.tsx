import { CopyButton } from '@/components/ui/CopyButton';
import { formatDateTime, formatIdr } from '@/lib/formatters';
import type { Order } from '../schema';
import { PaymentCountdown } from './PaymentCountdown';

/**
 * How to pay, and by when (FR-PAY-03, DESIGN.md §3.8).
 *
 * Rendered only while there is something to pay — the server sends `instructions` on a pending
 * charge and null on every other, so this panel cannot outlive the payment it describes.
 *
 * The account number is the one thing a customer has to carry into another app by hand, so it is
 * mono, spaced into groups of four, and copyable. The digits themselves stay unspaced in the
 * clipboard: a banking app that rejects spaces is far more common than one that needs them.
 */
export function PaymentPanel({ payment }: { payment: NonNullable<Order['payment']> }) {
  const { instructions } = payment;
  if (instructions === null) return null;

  return (
    <section aria-labelledby="payment-instructions" className="flex flex-col gap-4 border border-armor-150 bg-armor-000 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="payment-instructions" className="text-lg">
          Pay {formatIdr(instructions.amountIdr)}
        </h2>
        <p className="text-sm text-frame-300">
          <PaymentCountdown expiresAt={payment.expiresAt} /> — by {formatDateTime(payment.expiresAt)} WIB.
        </p>
      </div>

      <div className="flex flex-col gap-3 border border-armor-150 bg-armor-050 p-4">
        <p className="text-sm font-medium">{instructions.channel}</p>

        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xl font-semibold tabular-nums break-all">{grouped(instructions.accountNumber)}</p>
          <CopyButton value={instructions.accountNumber} label="Copy account number" />
        </div>

        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-frame-300">Account name</dt>
            <dd className="text-right font-medium">{instructions.accountName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-frame-300">Exact amount</dt>
            <dd className="text-right font-semibold tabular-nums">{formatIdr(instructions.amountIdr)}</dd>
          </div>
        </dl>
      </div>

      {instructions.steps.length === 0 ? null : (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm marker:text-frame-300">
          {instructions.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** `812345678901` → `8123 4567 8901`, the way a bank prints it. Display only. */
function grouped(accountNumber: string): string {
  return accountNumber.replace(/(.{4})/g, '$1 ').trimEnd();
}
