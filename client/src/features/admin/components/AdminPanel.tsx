import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The back office's one container: a titled card on the armor surface.
 *
 * Admin has a dozen screens made of the same shape — a heading, an optional action, and a body
 * that is usually a table or a form. Giving that shape a name is what stops each screen
 * inventing its own spacing, and what makes the whole back office look like one application.
 */
interface AdminPanelProps {
  title?: string;
  description?: string;
  /** Usually a button. Sits opposite the title. */
  action?: ReactNode;
  /** Removes the body padding, for a table that should meet the panel's edges. */
  isFlush?: boolean;
  className?: string;
  children: ReactNode;
}

export function AdminPanel({ title, description, action, isFlush = false, className, children }: AdminPanelProps) {
  return (
    <section className={cn('rounded-sm border border-armor-150 bg-armor-000', className)}>
      {title === undefined && action === undefined ? null : (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-armor-150 px-4 py-3">
          <div className="min-w-0">
            {title === undefined ? null : <h2 className="font-display text-sm font-semibold tracking-wide">{title}</h2>}
            {description === undefined ? null : (
              <p className="mt-0.5 text-xs text-frame-300">{description}</p>
            )}
          </div>
          {action === undefined ? null : <div className="flex shrink-0 gap-2">{action}</div>}
        </header>
      )}

      <div className={cn(isFlush ? '' : 'p-4')}>{children}</div>
    </section>
  );
}

/** The page heading every admin screen opens with. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-wide">{title}</h1>
        {description === undefined ? null : <p className="mt-1 text-sm text-frame-300">{description}</p>}
      </div>
      {action === undefined ? null : <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

/**
 * A table that scrolls inside its own box rather than pushing the page sideways.
 *
 * Admin tables are wide and the page must never scroll horizontally, so the overflow is owned
 * here once instead of being remembered on every screen.
 */
export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[40rem] border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-armor-150 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-frame-300',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('border-b border-armor-150 px-4 py-3 align-middle', className)}>{children}</td>;
}
