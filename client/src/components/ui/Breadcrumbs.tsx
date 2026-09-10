import Link from 'next/link';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';

/**
 * Breadcrumbs (FR-CAT-03).
 *
 * The last crumb is the current page, so it is text rather than a link — a link to where you
 * already are is a dead control, and `aria-current` is what tells a screen reader the trail has
 * ended.
 */
export interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumbs({ crumbs, className }: { crumbs: readonly Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-frame-300', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={crumb.href}>
              <li>
                {isLast ? (
                  <span aria-current="page" className="text-ink">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="reticle rounded-sm hover:text-ink hover:underline">
                    {crumb.label}
                  </Link>
                )}
              </li>
              {isLast ? null : (
                <li aria-hidden className="text-frame-300">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
