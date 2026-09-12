import { formatDateTime } from '@/lib/formatters';
import { ORDER_STATUS_LABELS } from '@/lib/labels';
import type { AdminOrder } from '../schema';

/**
 * Every status change, oldest first (FR-ORD-06).
 *
 * The customer's timeline shows the same events without attribution; this one names who made
 * each change, which is the whole reason `order_event` carries an actor. A guest's session id is
 * shown in full because on a guest order it is the only identifier there is — Phase 1 turns it
 * into a customer name without this component changing.
 */
const ACTOR_LABELS: Record<string, string> = {
  GUEST: 'Customer',
  USER: 'Customer',
  ADMIN: 'Back office',
  SYSTEM: 'Automatic',
};

export function OrderTimeline({ timeline }: { timeline: AdminOrder['timeline'] }) {
  return (
    <ol className="flex flex-col gap-3">
      {timeline.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2 shrink-0 rounded-full bg-core-blue" aria-hidden />
            {index < timeline.length - 1 ? <span className="w-px flex-1 bg-armor-150" aria-hidden /> : null}
          </div>

          <div className="pb-1">
            <p className="text-sm font-medium">{ORDER_STATUS_LABELS[entry.status]}</p>
            <p className="text-xs text-frame-300">
              {formatDateTime(entry.at)} · {ACTOR_LABELS[entry.actorKind] ?? entry.actorKind}
            </p>
            {entry.note === null ? null : <p className="mt-0.5 text-xs">{entry.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
