'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { IDLE } from '../action-result';
import { setInternalNoteAction } from '../actions';
import type { AdminOrder } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminTextarea } from './AdminField';
import { AdminPanel } from './AdminPanel';

/** The operator's private note on an order (FR-ADM-08). Never reaches the customer's view. */
export function OrderInternalNote({ order }: { order: AdminOrder }) {
  const [result, formAction, isPending] = useActionState(setInternalNoteAction.bind(null, order.orderNumber), IDLE);

  return (
    <form action={formAction}>
      <AdminPanel
        title="Internal note"
        description="Only the back office sees this."
        action={
          <div className="flex items-center gap-3">
            <ActionFeedback result={result} />
            <Button type="submit" variant="secondary" isLoading={isPending}>
              Save note
            </Button>
          </div>
        }
      >
        <AdminTextarea
          label="Note"
          name="internalNote"
          defaultValue={order.internalNote ?? ''}
          isOptional
          maxLength={2000}
          placeholder="Called the customer about the address — they confirmed the building name."
        />
      </AdminPanel>
    </form>
  );
}
