import { Star } from 'lucide-react';
import { formatCount, formatRating } from '@/lib/formatters';
import type { ProductReviewSummary } from '../schema';

/**
 * The average and the distribution above the list (FR-REV-05).
 *
 * The histogram is the part worth having: an average of 4.2 made of forty fives and ten ones is
 * a different product from one made of fifty fours, and only the bars show that.
 *
 * Rendered on the server. The bars are a table of counts, not a chart — each row is a rating, a
 * bar and a count, and the bar is `aria-hidden` because the count beside it already says it.
 */
export function ReviewSummary({ summary }: { summary: ProductReviewSummary }) {
  if (summary.count === 0) return null;

  const average = summary.averageTenths / 10;

  return (
    <div className="flex flex-col gap-4 border border-armor-150 bg-armor-050 p-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex shrink-0 flex-col items-start gap-1">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold tabular-nums">{formatRating(average)}</span>
          <Star className="size-4 self-center fill-signal-yellow text-signal-yellow" aria-hidden />
        </p>
        <p className="text-xs text-frame-300">
          {formatCount(summary.count)} {summary.count === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {summary.histogram.map((bucket) => (
          <li key={bucket.rating} className="flex items-center gap-2 text-xs">
            <span className="w-8 shrink-0 tabular-nums text-frame-300">{bucket.rating} ★</span>

            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-armor-150" aria-hidden>
              <span
                className="block h-full bg-signal-yellow"
                style={{ width: `${bucket.percent}%` }}
              />
            </span>

            <span className="w-10 shrink-0 text-right tabular-nums text-frame-300">{bucket.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
