'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/formatters';
import { IDLE } from '../action-result';
import { setShipmentAction } from '../actions';
import type { AdminOrder } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminFormGrid, AdminInput } from './AdminField';
import { AdminPanel } from './AdminPanel';

/**
 * Courier and tracking number (FR-ADM-08).
 *
 * Saveable before dispatch and editable after it, which is why it is its own form rather than a
 * field on the "mark shipped" button: a courier is often chosen the day before, and a tracking
 * number often arrives the day after. The API refuses to mark an order shipped until a courier
 * exists, so this is the step that unblocks that one.
 */
export function OrderShipmentForm({ order }: { order: AdminOrder }) {
  const [result, formAction, isPending] = useActionState(setShipmentAction.bind(null, order.orderNumber), IDLE);

  return (
    <form action={formAction}>
      <AdminPanel
        title="Shipment"
        description="A courier has to be set before the order can be marked shipped."
        action={
          <div className="flex items-center gap-3">
            <ActionFeedback result={result} />
            <Button type="submit" variant="secondary" isLoading={isPending}>
              Save shipment
            </Button>
          </div>
        }
      >
        <AdminFormGrid>
          <AdminInput
            label="Courier"
            name="courier"
            defaultValue={order.shipment?.courier ?? ''}
            required
            minLength={2}
            maxLength={80}
            placeholder="JNE"
          />
          <AdminInput
            label="Tracking number"
            name="trackingNumber"
            defaultValue={order.shipment?.trackingNumber ?? ''}
            isOptional
            maxLength={80}
            placeholder="JNE0012345678"
          />
        </AdminFormGrid>

        {order.shipment === null ? null : (
          <p className="mt-3 text-xs text-frame-300">
            {order.shipment.shippedAt === null
              ? 'Not yet handed to the courier.'
              : `Handed over ${formatDateTime(order.shipment.shippedAt)}.`}
            {order.shipment.deliveredAt === null
              ? ''
              : ` Delivered ${formatDateTime(order.shipment.deliveredAt)}.`}
          </p>
        )}
      </AdminPanel>
    </form>
  );
}
