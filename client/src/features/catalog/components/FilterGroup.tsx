'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/lib/cn';
import type { FacetOption } from '../schema';

/**
 * One collapsible group in the filter rail (DESIGN.md §3.2).
 *
 * Zero-count options render **disabled, not hidden** (FR-CAT-10) — options that vanish as you
 * tick make the filter set feel unstable, and their absence hides the fact that the thing you
 * were looking for exists but is currently excluded.
 *
 * A selected option is never disabled even at zero, or unticking it would be impossible: its
 * own count is computed without it, so a selection that now excludes everything else would
 * otherwise lock the user out of undoing it.
 */
interface FilterGroupProps {
  title: string;
  options: readonly FacetOption[];
  onToggle: (value: string) => void;
  /** Grade and series carry the most filtering power, so they open by default (DESIGN.md §3.2). */
  defaultOpen?: boolean;
  /** Groups that only apply to one tree — difficulty on kits, job on tools. */
  isHidden?: boolean;
}

export function FilterGroup({
  title,
  options,
  onToggle,
  defaultOpen = false,
  isHidden = false,
}: FilterGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isHidden || options.length === 0) return null;

  const selectedCount = options.filter((option) => option.isSelected).length;

  return (
    <div className="border-b border-armor-150 py-1">
      <h3>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="reticle flex min-h-11 w-full items-center justify-between gap-2 rounded-sm text-left font-display text-sm font-semibold"
        >
          <span>
            {title}
            {selectedCount > 0 && <span className="ml-1.5 font-normal text-core-blue">({selectedCount})</span>}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-frame-300 transition-transform duration-fast ease-out motion-reduce:transition-none',
              isOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h3>

      <div hidden={!isOpen} className="pb-1">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={option.isSelected}
            onCheckedChange={() => onToggle(option.value)}
            disabled={option.count === 0 && !option.isSelected}
            detail={option.count}
          />
        ))}
      </div>
    </div>
  );
}
