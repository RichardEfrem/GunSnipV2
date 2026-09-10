'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { SuggestPanel } from '@/features/search/components/SuggestPanel';
import { useSuggestions } from '@/features/search/hooks/use-suggestions';
import { SEARCH_PLACEHOLDERS } from '@/lib/navigation';

/**
 * The persistent header search and its suggestion panel (FR-SRCH-01, FR-SRCH-03).
 *
 * The field owns the query, the open state and the keyboard; `SuggestPanel` only renders what it
 * is given, and `useSuggestions` owns the debounce and the abort. Three small pieces rather than
 * one, because the alternative is a component with four `useState`s and an effect — which is the
 * point at which CLAUDE.md says to extract a hook.
 *
 * It stays a real `<form>` with a real `action`, so Enter submits and the whole thing works with
 * JavaScript unavailable — the suggestions are an accelerator layered on top of a search box
 * that already worked, not the mechanism itself.
 *
 * The placeholder is a real catalogue example, picked once per page load and never changed after
 * (DESIGN.md §4.1), so it cannot shift under someone mid-search. Picking it is a DOM write, not
 * state: a value chosen during render would not match the one the server chose and React would
 * report a hydration mismatch, while choosing it in an effect would set state on mount and
 * render the header twice. A ref callback runs in the commit phase, before the browser paints,
 * so the generic server value is never actually seen.
 */
function applyPlaceholder(element: HTMLInputElement | null): void {
  if (element === null) return;

  const index = Math.floor(Math.random() * SEARCH_PLACEHOLDERS.length);
  element.placeholder = `Search ${SEARCH_PLACEHOLDERS[index] ?? SEARCH_PLACEHOLDERS[0]}…`;
}

/** No row highlighted. Enter then means "search for what I typed", not "open a suggestion". */
const NO_ACTIVE_ROW = -1;

export function HeaderSearch() {
  const router = useRouter();
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_ROW);

  const { suggestions } = useSuggestions(query);

  const rows = suggestions === null ? [] : [...suggestions.products, ...suggestions.categories];
  const isPanelOpen = isOpen && suggestions !== null;

  const close = (): void => {
    setIsOpen(false);
    setActiveIndex(NO_ACTIVE_ROW);
  };

  const optionId = (index: number): string => `${panelId}-option-${index}`;

  const goTo = (index: number): void => {
    const row = rows[index];
    if (row === undefined) return;

    close();
    // A product suggestion carries a slug under /products; a category is a root segment.
    router.push('priceIdr' in row ? `/products/${row.slug}` : `/${row.slug}`);
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();

    if (activeIndex !== NO_ACTIVE_ROW) {
      goTo(activeIndex);
      return;
    }

    if (query.trim().length === 0) return;

    close();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  /**
   * Arrow keys move a highlight rather than focus. Moving focus into the list would empty the
   * input's own selection and make the next keystroke land somewhere unexpected, which is why
   * the pattern is `aria-activedescendant` and not a roving tabindex.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      close();
      return;
    }

    if (!isPanelOpen || rows.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % rows.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? rows.length - 1 : current - 1));
    }
  };

  /**
   * Closing on blur has to survive focus moving *within* the panel — a click on a suggestion
   * blurs the input before the link fires. `relatedTarget` says where focus went, so the panel
   * stays open when it went somewhere inside.
   */
  const onBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
    if (!container.current?.contains(event.relatedTarget)) close();
  };

  return (
    <div ref={container} className="relative flex-1" onBlur={onBlur}>
      <form action="/search" role="search" onSubmit={submit}>
        <label htmlFor="header-search" className="sr-only">
          Search kits, tools and mobile suits
        </label>

        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-frame-muted"
          aria-hidden
        />

        <input
          ref={applyPlaceholder}
          id="header-search"
          name="q"
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={isPanelOpen}
          aria-controls={isPanelOpen ? panelId : undefined}
          aria-activedescendant={activeIndex === NO_ACTIVE_ROW ? undefined : optionId(activeIndex)}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            // Any edit invalidates the highlight — the row under it is about to be a different
            // product, and Enter must not open whatever happens to land in that position.
            setActiveIndex(NO_ACTIVE_ROW);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search kits, tools and mobile suits…"
          className="h-10 w-full rounded-sm border border-frame-field-border bg-frame-700 pl-9 pr-3 text-base text-white transition-colors duration-fast ease-out placeholder:text-frame-muted focus-visible:border-core-blue"
        />
      </form>

      {isPanelOpen ? (
        <SuggestPanel
          id={panelId}
          suggestions={suggestions}
          activeIndex={activeIndex}
          optionId={optionId}
          onNavigate={close}
        />
      ) : null}
    </div>
  );
}
