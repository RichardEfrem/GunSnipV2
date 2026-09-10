'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { NavItem } from '@/lib/navigation';

/**
 * A two-column nav panel, opened on **click, not hover** (DESIGN.md §4.1) — hover menus
 * misfire when the pointer crosses them and do not exist at all on touch.
 */
interface NavDropdownProps {
  item: NavItem & { columns: NonNullable<NavItem['columns']> };
}

export function NavDropdown({ item }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    // Escape closes and focus returns to the trigger, as with any other overlay (DESIGN.md §6).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={container} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="reticle flex h-10 items-center gap-1 rounded-sm px-2 font-display text-sm font-semibold text-white transition-colors duration-fast ease-out hover:text-core-blue"
      >
        {item.label}
        <ChevronDown
          className={cn('size-4 transition-transform duration-fast ease-out', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div className="enter-settle on-armor absolute left-0 top-full z-40 grid w-160 grid-cols-2 gap-6 border border-armor-150 bg-armor-000 p-5 text-ink shadow-float">
          {item.columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-1">
              <p className="mb-1 font-display text-xs font-semibold text-frame-300">{column.heading}</p>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="reticle rounded-sm px-2 py-1.5 text-sm transition-colors duration-fast ease-out hover:bg-core-blue-tint hover:text-core-blue"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
