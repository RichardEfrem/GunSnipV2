'use client';

import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useCancelOrder } from '../hooks/use-cancel-order';

/**
 * "Cancel order" while it awaits payment (FR-ORD-04). Confirmed in a dialog, because it cannot be
 * undone: the reserved kits go back on sale the moment it is done (DoD §13.6). The page only
 * renders this while the server says the order can be cancelled.
 */
interface CancelOrderButtonProps {
  orderNumber: string;
  /** Present when the page was reached through guest lookup — it is what proves access. */
  email: string | undefined;
}

export function CancelOrderButton({ orderNumber, email }: CancelOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isCancelling, error, cancel } = useCancelOrder(orderNumber, email);

  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)} className="w-full">
        Cancel order
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`Cancel ${orderNumber}?`}
        description="Nothing has been paid yet. Cancelling releases the items to other customers and can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Keep order
            </Button>
            <Button variant="danger" isLoading={isCancelling} onClick={cancel}>
              Cancel order
            </Button>
          </>
        }
      >
        {error === null ? undefined : (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
