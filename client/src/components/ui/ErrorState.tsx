import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * DESIGN.md §4.5: what failed, and what to do. No apology, no "Oops".
 *
 * The icon is not decoration — `--sortie-red` and `--danger` are both red, so an error always
 * pairs colour with an icon and text rather than relying on hue (DESIGN.md §2.1, §6).
 */
interface ErrorStateProps {
  title: string;
  /** What it means for them: "The catalogue didn't respond. Your cart is safe." */
  description: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}
    >
      <TriangleAlert className="size-6 text-danger" aria-hidden />
      <h2 className="text-lg">{title}</h2>
      <p className="max-w-measure text-sm text-frame-300">{description}</p>
      {action === undefined ? null : <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
