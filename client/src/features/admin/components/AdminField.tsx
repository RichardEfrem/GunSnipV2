'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_HINT } from '@/lib/constants';

/**
 * The back office's form controls.
 *
 * Not `components/ui/Input`: that one is the storefront's checkout field (DESIGN.md §4.4) — 48px
 * tall with a hint line and a blur-validation contract, sized for one thumb on a phone. Admin
 * forms are dense grids of twenty fields on a desktop, and using the checkout control for them
 * would make every editor three screens long.
 *
 * What they share is the part that matters: a real `<label>` above the field, never a
 * placeholder standing in for one, and an error that is announced rather than only coloured.
 */
const CONTROL =
  'h-10 w-full rounded-sm border border-field-border bg-armor-000 px-3 text-sm transition-colors duration-fast ease-out placeholder:text-frame-300 focus-visible:border-core-blue disabled:cursor-not-allowed disabled:bg-armor-050 disabled:text-frame-300';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  isOptional?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, hint, isOptional = false, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-frame-300">
        {label}
        {isOptional ? <span className="ml-1 font-normal">(optional)</span> : null}
      </label>
      {children}
      {hint === undefined ? null : <p className="text-xs text-frame-300">{hint}</p>}
    </div>
  );
}

interface AdminInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  hint?: string;
  isOptional?: boolean;
  className?: string;
}

export function AdminInput({ label, hint, isOptional, className, ...props }: AdminInputProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} isOptional={isOptional} className={className}>
      <input {...props} id={id} className={CONTROL} />
    </FieldShell>
  );
}

interface AdminImageInputProps {
  label: string;
  name: string;
  isRequired?: boolean;
  isOptional?: boolean;
  /** Replaces the default hint, which names the accepted formats and the size cap. */
  hint?: string;
  className?: string;
}

/**
 * A file picker limited to the formats the API accepts. The API re-encodes to WebP whatever it
 * is given, so this narrows the picker to spare an operator a refusal — it is not the check.
 */
export function AdminImageInput({ label, name, isRequired = false, isOptional, hint, className }: AdminImageInputProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint ?? IMAGE_UPLOAD_HINT} isOptional={isOptional} className={className}>
      <input
        id={id}
        name={name}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        required={isRequired}
        className="text-sm file:mr-3 file:rounded-sm file:border file:border-core-blue file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-core-blue"
      />
    </FieldShell>
  );
}

interface AdminSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  label: string;
  hint?: string;
  isOptional?: boolean;
  className?: string;
  children: ReactNode;
}

export function AdminSelect({ label, hint, isOptional, className, children, ...props }: AdminSelectProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} isOptional={isOptional} className={className}>
      <select {...props} id={id} className={CONTROL}>
        {children}
      </select>
    </FieldShell>
  );
}

interface AdminTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  label: string;
  hint?: string;
  isOptional?: boolean;
  className?: string;
}

export function AdminTextarea({ label, hint, isOptional, className, ...props }: AdminTextareaProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} isOptional={isOptional} className={className}>
      <textarea {...props} id={id} className={cn(CONTROL, 'h-auto min-h-24 py-2 leading-relaxed')} />
    </FieldShell>
  );
}

/** A checkbox and its label on one line, which is the only way a boolean reads in a dense form. */
export function AdminCheckbox({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'className'> & {
  label: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          {...props}
          id={id}
          type="checkbox"
          className="size-4 shrink-0 rounded-sm border-field-border accent-core-blue"
        />
        {label}
      </label>
      {hint === undefined ? null : <p className="pl-6 text-xs text-frame-300">{hint}</p>}
    </div>
  );
}

/** The standard two-column grid an admin form is laid out on. */
export function AdminFormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
