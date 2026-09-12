'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, CircleAlert } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  /** Zero-result options render disabled, not hidden (DESIGN.md §3.2). */
  disabled?: boolean;
}

/**
 * Radix supplies the listbox behaviour — typeahead, roving focus, Escape, scroll locking —
 * which is a great deal of keyboard handling not worth reimplementing. The chrome is ours
 * (DESIGN.md §7).
 */
interface SelectProps {
  label: string;
  isLabelHidden?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** The message below the field, as on `Input`. Its presence puts the field in the error state. */
  error?: string;
  className?: string;
}

export function Select({
  label,
  isLabelHidden = false,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  error,
  className,
}: SelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = error !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn('text-sm font-medium', isLabelHidden && 'sr-only')}>
        {label}
      </label>

      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            'reticle inline-flex h-11 w-full items-center justify-between gap-2 rounded-sm bg-armor-000 px-3 text-base',
            'border border-field-border transition-colors duration-fast ease-out',
            'data-[state=open]:border-core-blue',
            hasError && 'border-danger data-[state=open]:border-danger',
            'data-[placeholder]:text-frame-300',
            'disabled:cursor-not-allowed disabled:bg-armor-050 disabled:text-frame-300',
            className,
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="size-4 text-frame-300" aria-hidden />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          {/* A dropdown genuinely floats, so this is one of the few places a shadow is
              allowed instead of a panel line (DESIGN.md §2.3). */}
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="enter-settle z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-sm border border-armor-150 bg-armor-000 shadow-float"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'flex h-10 cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-2.5 text-sm outline-none',
                    'data-highlighted:bg-core-blue-tint data-highlighted:text-core-blue',
                    'data-disabled:cursor-not-allowed data-disabled:text-frame-300',
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="size-4 text-core-blue" aria-hidden />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {hasError ? (
        // Colour is never the only signal, so the icon rides with the message (DESIGN.md §6).
        <p id={errorId} className="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
