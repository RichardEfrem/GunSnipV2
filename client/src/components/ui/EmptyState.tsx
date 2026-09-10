import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * DESIGN.md §4.5: an empty state owes a reason and a route out. "No results" on its own is a
 * dead end — the second line is the component's whole point, so it is required.
 */
interface EmptyStateProps {
  title: string;
  /** Why it is empty and what would change it: "Try removing 'In stock' — 42 kits are on preorder." */
  description: string;
  /** One or two ways forward, usually Buttons. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}>
      <h2 className="text-lg">{title}</h2>
      <p className="max-w-measure text-sm text-frame-300">{description}</p>
      {action === undefined ? null : <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
