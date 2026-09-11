'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The lower section of the product page (FR-PDP-09): description, specifications, reviews,
 * shipping.
 *
 * A real ARIA tablist — arrow keys move between tabs, Home and End jump to the ends, and only
 * the active tab is a tab stop (DESIGN.md §6). Browsers give none of this for free, and a row
 * of buttons that merely looks like tabs is the usual way it gets skipped.
 *
 * Panels are rendered by the server and hidden with `hidden` rather than unmounted: the content
 * is already on the page, it is indexable in all four tabs, and switching costs no request.
 */
export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface ProductTabsProps {
  tabs: readonly ProductTab[];
}

export function ProductTabs({ tabs }: ProductTabsProps) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (tabs.length === 0) return null;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.id === activeId);

    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;

    if (nextIndex === -1) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    if (next === undefined) return;

    setActiveId(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Product details"
        // Scrolls rather than wrapping on a narrow screen: four wrapped tabs read as two rows
        // of buttons, which is not a tablist any more.
        className="flex gap-1 overflow-x-auto border-b border-armor-150"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={onKeyDown}
              className={cn(
                'reticle -mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-sm font-semibold transition-colors duration-fast ease-out',
                isActive
                  ? 'border-core-blue text-core-blue'
                  : 'border-transparent text-frame-300 hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          // A panel is focusable so a keyboard user landing on it from the tab can read it.
          tabIndex={0}
          hidden={tab.id !== activeId}
          className="reticle rounded-sm text-sm leading-relaxed"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
