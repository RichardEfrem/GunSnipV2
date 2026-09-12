'use client';

import { formatDuration } from '@/lib/formatters';
import { useCountdown } from '../hooks/use-countdown';

/**
 * "Complete payment within 23:47:12" (DESIGN.md §3.8, FR-PAY-03).
 *
 * Live, because the deadline is the whole point of the panel it sits in. The absolute time is
 * printed beside it by the caller, so the placeholder shown before the first tick — and to anyone
 * without JavaScript — costs no information.
 *
 * At zero it says so rather than counting into negatives: the expiry sweep runs every few
 * minutes, so an order is briefly past its window and not yet cancelled, and "00:00:00" would
 * invite a payment that will not be matched.
 */
export function PaymentCountdown({ expiresAt }: { expiresAt: string }) {
  const secondsLeft = useCountdown(expiresAt);

  if (secondsLeft === 0) {
    return <span className="font-medium text-danger">The payment window has closed.</span>;
  }

  return (
    <span>
      Complete payment within{' '}
      <span className="font-mono font-semibold tabular-nums" aria-live="off">
        {secondsLeft === null ? '--:--:--' : formatDuration(secondsLeft)}
      </span>
    </span>
  );
}
