'use client';

import { Checkbox } from '@/components/ui/Checkbox';
import type { Facets } from '../schema';
import type { ListFilterKey, ListState } from '../search-params';
import { FilterGroup } from './FilterGroup';

/**
 * The filter groups themselves, without any of the chrome around them.
 *
 * Extracted because the desktop rail and the mobile sheet show the *same* controls wired to
 * different state — the rail commits each tick straight to the URL, the sheet collects a draft
 * and commits on "Show N kits" (DESIGN.md §3.2, §3.3). Two copies of this list would drift the
 * first time a filter was added to one of them.
 */
interface FilterControlsProps {
  facets: Facets;
  state: ListState;
  /** MODEL_KIT hides the tool job group; TOOL_SUPPLY hides grade, scale, series and difficulty. */
  isToolTree: boolean;
  onToggle: (key: ListFilterKey, value: string) => void;
  onStockOnlyChange: (inStock: boolean) => void;
}

/** Which facet group feeds which URL key, in the order DESIGN.md §3.2 lists them. */
const GROUPS: readonly {
  key: ListFilterKey;
  title: string;
  facet: keyof Pick<Facets, 'grades' | 'scales' | 'series' | 'brands' | 'difficulties' | 'toolJobs'>;
  defaultOpen?: boolean;
  tree?: 'kits' | 'tools';
}[] = [
  { key: 'grade', title: 'Grade', facet: 'grades', defaultOpen: true, tree: 'kits' },
  { key: 'scale', title: 'Scale', facet: 'scales', tree: 'kits' },
  { key: 'series', title: 'Series', facet: 'series', defaultOpen: true, tree: 'kits' },
  { key: 'difficulty', title: 'Difficulty', facet: 'difficulties', tree: 'kits' },
  { key: 'toolJob', title: 'Job', facet: 'toolJobs', defaultOpen: true, tree: 'tools' },
  { key: 'brand', title: 'Brand', facet: 'brands' },
];

export function FilterControls({
  facets,
  state,
  isToolTree,
  onToggle,
  onStockOnlyChange,
}: FilterControlsProps) {
  return (
    <>
      <div className="border-b border-armor-150 py-1">
        <Checkbox
          label="In stock only"
          checked={state.inStock}
          onCheckedChange={onStockOnlyChange}
          detail={facets.inStockCount}
        />
      </div>

      {GROUPS.map((group) => (
        <FilterGroup
          key={group.key}
          title={group.title}
          options={facets[group.facet]}
          onToggle={(value) => onToggle(group.key, value)}
          defaultOpen={group.defaultOpen}
          isHidden={group.tree !== undefined && group.tree !== (isToolTree ? 'tools' : 'kits')}
        />
      ))}
    </>
  );
}
