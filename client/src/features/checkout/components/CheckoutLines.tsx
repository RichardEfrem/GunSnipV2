import { TriangleAlert } from 'lucide-react';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { formatIdr } from '@/lib/formatters';
import { checkoutNoticeText } from '../notice-copy';
import type { CheckoutLine } from '../schema';

/**
 * What is being ordered, compactly, at the top of the summary (DESIGN.md §3.7). A line that
 * changed since it was added says so here too — the last place to notice before paying.
 */
export function CheckoutLines({ lines }: { lines: readonly CheckoutLine[] }) {
  return (
    <ul className="flex flex-col divide-y divide-armor-150">
      {lines.map((line) => (
        <li key={line.variantId} className="flex gap-3 py-3 first:pt-0">
          <Thumbnail src={line.image?.url ?? null} blurDataUrl={line.image?.blurDataUrl} size={48} />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <p className="line-clamp-2 font-medium">{line.productName}</p>
            {line.variantName === null ? null : <p className="text-xs text-frame-300">{line.variantName}</p>}
            <p className="text-xs tabular-nums text-frame-300">
              {line.quantity} × {formatIdr(line.unitPriceIdr)}
            </p>

            {line.notices.map((notice) => (
              <p key={notice.kind} className="flex items-start gap-1.5 text-xs text-warn">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {checkoutNoticeText(notice, line)}
              </p>
            ))}
          </div>

          <p className="text-sm font-medium tabular-nums">{formatIdr(line.lineTotalIdr)}</p>
        </li>
      ))}
    </ul>
  );
}
