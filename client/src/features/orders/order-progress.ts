import type { OrderStatus } from '@gunsnip/shared';
import type { Order, OrderTimelineEntry } from './schema';

/**
 * The status timeline's model (DESIGN.md §3.8, FR-ORD-03): five steps, each done, current or
 * still to come, drawn from the order's event history.
 *
 * Presentation only — which transitions are *legal* is the server's state machine; this reads
 * which have *happened*. An order that ended early (cancelled, expired, refunded) keeps the steps
 * it reached as done, and its ending is shown beside them rather than as a sixth step.
 */
const STEPS: readonly { status: OrderStatus; label: string }[] = [
  { status: 'PENDING_PAYMENT', label: 'Placed' },
  { status: 'PAID', label: 'Paid' },
  { status: 'PACKING', label: 'Packing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const ENDINGS: ReadonlySet<OrderStatus> = new Set(['CANCELLED', 'EXPIRED', 'REFUNDED']);

export type StepState = 'done' | 'current' | 'upcoming';

export interface ProgressStep {
  label: string;
  state: StepState;
  /** When the order reached it, if it has. */
  at: string | null;
}

export interface OrderProgress {
  steps: readonly ProgressStep[];
  /** How an order that stopped short ended, or null for one still going or completed. */
  ending: OrderTimelineEntry | null;
}

export function orderProgress(order: Pick<Order, 'status' | 'timeline'>): OrderProgress {
  const reachedAt = new Map(order.timeline.map((entry) => [entry.status, entry.at]));
  const currentIndex = STEPS.findIndex((step) => step.status === order.status);
  const lastReached = STEPS.reduce((last, step, index) => (reachedAt.has(step.status) ? index : last), -1);

  return {
    steps: STEPS.map((step, index) => ({
      label: step.label,
      at: reachedAt.get(step.status) ?? null,
      state: stateOf(index, currentIndex, lastReached),
    })),
    ending: ENDINGS.has(order.status)
      ? (order.timeline.findLast((entry) => entry.status === order.status) ?? null)
      : null,
  };
}

/** A status on the line is current; one off it (completed, cancelled…) has no current step. */
function stateOf(index: number, currentIndex: number, lastReached: number): StepState {
  if (currentIndex === -1) return index <= lastReached ? 'done' : 'upcoming';
  if (index < currentIndex) return 'done';
  return index === currentIndex ? 'current' : 'upcoming';
}
