'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * An edge-anchored panel: the mobile filter and sort sheets (DESIGN.md §3.3) and the mini-cart
 * drawer (FR-CART-09).
 *
 * Built on Radix Dialog, so it traps focus, closes on Escape and returns focus to the trigger
 * (DESIGN.md §6) without any of that being reimplemented per use.
 */
const SIDES = {
  // ~85% height, so the list behind stays visible and the sheet reads as covering rather than
  // replacing the page (DESIGN.md §3.3).
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-sm enter-rise',
  right: 'inset-y-0 right-0 w-full max-w-100 enter-slide',
} as const;

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Anchor edge. Bottom for mobile filter and sort, right for the mini-cart. */
  side?: keyof typeof SIDES;
  children: ReactNode;
  /** Pinned below the scrolling body — "Show 218 kits", "Checkout". */
  footer?: ReactNode;
  trigger?: ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  side = 'bottom',
  children,
  footer,
  trigger,
}: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger === undefined ? null : <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="enter-fade fixed inset-0 z-40 bg-black/50" />

        <RadixDialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-armor-000 shadow-float',
            // The frame is dark, and a sheet is frame — but its contents are merchandise, so
            // the surface stays armor and only the header rail reads as structure.
            SIDES[side],
          )}
        >
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-armor-150 px-4">
            <RadixDialog.Title className="text-lg">{title}</RadixDialog.Title>
            <RadixDialog.Close className="reticle -mr-1 grid size-11 place-items-center rounded-sm text-frame-300 transition-colors duration-fast ease-out hover:bg-ink-tint hover:text-ink">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close</span>
            </RadixDialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto p-4">{children}</div>

          {footer === undefined ? null : (
            <footer className="shrink-0 border-t border-armor-150 p-4">{footer}</footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
