'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A centred modal: confirmations that genuinely need one — "Cancel this order?", a stock
 * adjustment reason in admin. Distinct from `Sheet`, which is anchored to an edge and used for
 * browsing rather than deciding.
 *
 * Radix handles the focus trap, Escape and focus return (DESIGN.md §6).
 */
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Announced with the title. Say what will happen, not "are you sure". */
  description?: string;
  children?: ReactNode;
  /** The actions. Destructive ones use the danger Button variant. */
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="enter-fade fixed inset-0 z-40 bg-black/50" />

        <RadixDialog.Content className="enter-settle fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-120 -translate-x-1/2 -translate-y-1/2 border border-armor-150 bg-armor-000 shadow-float">
          <header className="flex items-start justify-between gap-4 border-b border-armor-150 p-4">
            <div className="flex flex-col gap-1">
              <RadixDialog.Title className="text-lg">{title}</RadixDialog.Title>
              {description === undefined ? null : (
                <RadixDialog.Description className="text-sm text-frame-300">
                  {description}
                </RadixDialog.Description>
              )}
            </div>

            <RadixDialog.Close className="reticle -mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-sm text-frame-300 transition-colors duration-fast ease-out hover:bg-ink-tint hover:text-ink">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close</span>
            </RadixDialog.Close>
          </header>

          {children === undefined ? null : <div className="p-4">{children}</div>}

          {footer === undefined ? null : (
            <footer className="flex justify-end gap-3 border-t border-armor-150 p-4">{footer}</footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
