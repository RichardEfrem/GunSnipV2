'use client';

import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * The filter bar above an admin list.
 *
 * **The URL is the only state** (FR-CAT-07's rule, applied to the back office): every control
 * reads its current value from `useSearchParams` and writes the next one by navigating. Nothing
 * is mirrored into `useState`, so the back button, a refresh and a pasted link all work, and a
 * filtered list is something an operator can send to a colleague.
 *
 * Changing any filter drops `cursor`. A cursor is a position in the *previous* result set and
 * carrying it into a new one would land the operator in the middle of a list they have not seen
 * the start of.
 */
interface SelectFilter {
  name: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
}

interface DateFilter {
  name: string;
  label: string;
  value: string | undefined;
}

interface AdminListFiltersProps {
  basePath: string;
  search?: { name: string; label: string; placeholder: string; value: string | undefined };
  selects?: SelectFilter[];
  /** `yyyy-mm-dd` bounds. The page turns them into instants — this only carries the day. */
  dates?: DateFilter[];
}

export function AdminListFilters({ basePath, search, selects = [], dates = [] }: AdminListFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function go(next: URLSearchParams): void {
    next.delete('cursor');
    const query = next.toString();
    router.push(query.length === 0 ? basePath : `${basePath}?${query}`);
  }

  function set(name: string, value: string): void {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(name);
    else next.set(name, value);

    go(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (search === undefined) return;

    const value = new FormData(event.currentTarget).get(search.name);
    set(search.name, typeof value === 'string' ? value.trim() : '');
  }

  const hasFilters = [...params.keys()].some((key) => key !== 'cursor');

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      {search === undefined ? null : (
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="admin-filter-search" className="text-xs font-medium text-frame-300">
            {search.label}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-frame-300" aria-hidden />
            <input
              id="admin-filter-search"
              name={search.name}
              type="search"
              defaultValue={search.value ?? ''}
              placeholder={search.placeholder}
              className="h-10 w-full rounded-sm border border-field-border bg-armor-000 pl-9 pr-3 text-sm transition-colors duration-fast ease-out placeholder:text-frame-300 focus-visible:border-core-blue"
            />
          </div>
        </div>
      )}

      {selects.map((select) => (
        <div key={select.name} className="flex flex-col gap-1.5">
          <label htmlFor={`admin-filter-${select.name}`} className="text-xs font-medium text-frame-300">
            {select.label}
          </label>
          <select
            id={`admin-filter-${select.name}`}
            value={select.value ?? ''}
            onChange={(event) => set(select.name, event.target.value)}
            className="h-10 rounded-sm border border-field-border bg-armor-000 px-3 text-sm transition-colors duration-fast ease-out focus-visible:border-core-blue"
          >
            <option value="">All</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {dates.map((date) => (
        <div key={date.name} className="flex flex-col gap-1.5">
          <label htmlFor={`admin-filter-${date.name}`} className="text-xs font-medium text-frame-300">
            {date.label}
          </label>
          <input
            id={`admin-filter-${date.name}`}
            type="date"
            value={date.value ?? ''}
            onChange={(event) => set(date.name, event.target.value)}
            className="h-10 rounded-sm border border-field-border bg-armor-000 px-3 text-sm transition-colors duration-fast ease-out focus-visible:border-core-blue"
          />
        </div>
      ))}

      {/* The search field needs a submit; the selects and dates navigate on change, so this is
          only ever about the text box — hence it sits at the end of the row rather than beside
          each one. */}
      {search === undefined ? null : <Button type="submit" variant="secondary">Search</Button>}

      {hasFilters ? (
        <Button type="button" variant="ghost" onClick={() => go(new URLSearchParams())}>
          Clear
        </Button>
      ) : null}
    </form>
  );
}
