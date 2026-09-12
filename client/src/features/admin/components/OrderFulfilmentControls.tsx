'use client';

import type { OrderStatus } from '@gunsnip/shared';
import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { ORDER_STATUS_LABELS } from '@/lib/labels';
import { IDLE, type ActionResult } from '../action-result';
import { advanceOrderAction, cancelOrderAction, settlePaymentAction } from '../actions';
import type { AdminOrder } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminInput, AdminTextarea } from './AdminField';

/**
 * Advancing, settling and cancelling an order (FR-ADM-08).
 *
 * **The buttons come from the server.** `nextStatuses` is the order state machine's own answer
 * for this order (PRD §8.1), so the screen never offers a move that would be refused and never
 * needs its own copy of the lifecycle — a status added to the machine appears here with no change
 * to this file.
 *
 * Two statuses are deliberately not on that list as buttons: PAID is reached by settling the
 * payment, which writes the payment row too, and CANCELLED needs a reason. Both get their own
 * control, which mirrors the API's own split.
 */
export function OrderFulfilmentControls({ order }: { order: AdminOrder }) {
  const [isCancelling, setIsCancelling] = useState(false);

  // The generic advance buttons: everything the machine allows, minus the two with their own
  // path. Filtering here rather than hiding them in the server's answer keeps `nextStatuses`
  // meaning "what the lifecycle allows" rather than "what this screen chose to show".
  const advanceable = order.nextStatuses.filter((status) => status !== 'PAID' && status !== 'CANCELLED');
  const canSettle = order.payment?.status === 'PENDING' && order.nextStatuses.includes('PAID');
  const canCancel = order.nextStatuses.includes('CANCELLED');

  return (
    <div className="flex flex-col gap-4">
      {canSettle ? <SettlePayment orderNumber={order.orderNumber} /> : null}

      {advanceable.map((status) => (
        <AdvanceTo key={status} orderNumber={order.orderNumber} status={status} />
      ))}

      {advanceable.length === 0 && !canSettle && !canCancel ? (
        <p className="text-sm text-frame-300">
          This order has reached the end of its lifecycle. Nothing further can be done to it.
        </p>
      ) : null}

      {canCancel ? (
        <div className="border-t border-armor-150 pt-4">
          {isCancelling ? (
            <CancelOrder orderNumber={order.orderNumber} onDismiss={() => setIsCancelling(false)} />
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setIsCancelling(true)}>
              Cancel order
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Marking the charge paid (FR-PAY-04). The mock provider has no webhook to wait for, so while a
 * bank transfer is confirmed by hand this is how an order moves off awaiting-payment.
 */
function SettlePayment({ orderNumber }: { orderNumber: string }) {
  const [result, setResult] = useState<ActionResult>(IDLE);
  const [isPending, startTransition] = useTransition();

  function settle(status: 'PAID' | 'FAILED'): void {
    startTransition(async () => {
      setResult(await settlePaymentAction(orderNumber, status));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button isLoading={isPending} onClick={() => settle('PAID')}>
        Mark payment received
      </Button>
      <Button variant="ghost" isLoading={isPending} onClick={() => settle('FAILED')}>
        Mark payment failed
      </Button>
      <ActionFeedback result={result} />
    </div>
  );
}

function AdvanceTo({ orderNumber, status }: { orderNumber: string; status: OrderStatus }) {
  const [result, formAction, isPending] = useActionState(
    advanceOrderAction.bind(null, orderNumber, status),
    IDLE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <AdminInput
        label={`Note for “${ORDER_STATUS_LABELS[status]}”`}
        name="note"
        isOptional
        maxLength={500}
        placeholder="Goes on the history entry"
      />
      <Button type="submit" variant="secondary" isLoading={isPending}>
        Move to {ORDER_STATUS_LABELS[status].toLowerCase()}
      </Button>
      <ActionFeedback result={result} />
    </form>
  );
}

/** FR-ADM-08 makes the reason mandatory, so cancelling is a form rather than a button. */
function CancelOrder({ orderNumber, onDismiss }: { orderNumber: string; onDismiss: () => void }) {
  const [result, formAction, isPending] = useActionState(cancelOrderAction.bind(null, orderNumber), IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <AdminTextarea
        label="Why is it being cancelled?"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        placeholder="Out of stock at the warehouse."
        hint="The customer sees this on their order."
      />

      <div className="flex gap-2">
        <Button type="submit" variant="danger" isLoading={isPending}>
          Cancel order
        </Button>
        <Button type="button" variant="ghost" onClick={onDismiss}>
          Keep it
        </Button>
      </div>

      <ActionFeedback result={result} />
    </form>
  );
}
