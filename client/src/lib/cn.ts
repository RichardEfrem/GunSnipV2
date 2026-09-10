import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes so a later class wins over an earlier one in the same group.
 *
 * Every `components/ui` primitive takes a `className` and merges it with this, which is what
 * makes a primitive adjustable at the call site without a variant explosion (CLAUDE.md).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
