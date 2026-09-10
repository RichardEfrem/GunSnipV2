'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { HEADER_COLLAPSE_OFFSET } from '@/lib/constants';

/**
 * Owns one piece of state: whether the page has scrolled past 200px, at which point row 2
 * collapses and row 1 compresses to 56px (DESIGN.md §4.1).
 *
 * It publishes that as `data-collapsed` on the <header> rather than passing it down, so the
 * rows stay server-rendered and style themselves with `group-data-*`. The client boundary
 * stops here.
 */
interface HeaderShellProps {
  children: ReactNode;
}

export function HeaderShell({ children }: HeaderShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Not data fetching — this is scroll position, which only exists in the browser.
    const onScroll = () => setIsCollapsed(window.scrollY > HEADER_COLLAPSE_OFFSET);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-collapsed={isCollapsed}
      className="on-frame group sticky top-0 z-30 bg-frame-900 text-white"
    >
      {children}
    </header>
  );
}
