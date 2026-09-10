'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * An applied-filter chip (DESIGN.md §3.2).
 *
 * Non-negotiable on the listing page: without them, users read filtered results as the whole
 * catalogue. Removing one is a URL change, not local state (FR-CAT-07), so the chip only
 * reports the intent and the caller rewrites the query string.
 */
interface ChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function Chip({ label, onRemove, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-sm border border-armor-150 bg-armor-000 pl-2.5 pr-1 text-sm',
        className,
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        // 44px of hit area on touch without a 44px-looking chip.
        className="reticle grid size-6 place-items-center rounded-sm text-frame-300 transition-colors duration-fast ease-out hover:bg-ink-tint hover:text-ink"
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Remove {label} filter</span>
      </button>
    </span>
  );
}
