import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/formatters';
import { orderProgress, type StepState } from '../order-progress';
import type { Order } from '../schema';

/**
 * The status timeline (DESIGN.md §3.8): horizontal on desktop, vertical on mobile. Done steps
 * `--ok`, the current one `--core-blue` filled, future ones `--armor-150` — each also said in
 * words, since colour is never the only signal (DESIGN.md §6).
 */
const STATE_WORDS: Record<StepState, string> = { done: 'done', current: 'current step', upcoming: 'to come' };

export function OrderTimeline({ order }: { order: Pick<Order, 'status' | 'timeline'> }) {
  const { steps } = orderProgress(order);

  return (
    <ol aria-label="Order progress" className="flex flex-col gap-0 md:flex-row">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-2 md:pb-0">
          {/* The connector to the next step: down on mobile, across on desktop. */}
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                'absolute left-3 top-6 h-[calc(100%-1.5rem)] w-px md:left-[calc(50%+0.75rem)] md:top-3 md:h-px md:w-[calc(100%-1.5rem)]',
                step.state === 'done' ? 'bg-ok' : 'bg-armor-150',
              )}
            />
          ) : null}

          <span
            aria-hidden
            className={cn(
              'relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2',
              step.state === 'done' && 'border-ok bg-ok text-white',
              step.state === 'current' && 'border-core-blue bg-core-blue',
              step.state === 'upcoming' && 'border-armor-150 bg-armor-000',
            )}
          >
            {step.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>

          <span className="flex flex-col md:items-center md:text-center">
            <span className={cn('text-sm', step.state === 'upcoming' ? 'text-frame-300' : 'font-medium')}>
              {step.label}
              <span className="sr-only"> ({STATE_WORDS[step.state]})</span>
            </span>
            {step.at === null ? null : <span className="text-xs text-frame-300">{formatDate(step.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
