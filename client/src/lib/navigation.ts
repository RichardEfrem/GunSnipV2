/**
 * The header's navigation model (DESIGN.md §4.1).
 *
 * The hrefs are real category slugs, which are globally unique and already namespaced
 * (`kits-mg`, `tools-nippers`), so a category is one path segment at the root — see
 * `app/(storefront)/[category]/page.tsx`.
 *
 * **Grade and series are filter URLs, not categories.** Both are facets, and a facet has to
 * stay widenable from the rail: on `/kits-rg` the category *is* the scope, so every other grade
 * counts zero and renders disabled (FR-CAT-10), and the only way out is the back button. On
 * `/kits?grade=RG` the same rail counts each grade across the whole Kits tree and ticking
 * Master Grade widens the set (FR-CAT-05), which is what DESIGN.md §3.2 draws. The home page's
 * grade shortcuts already link this way. The `kits-*` categories still exist — they are where a
 * product hangs in the taxonomy — they are just not the browse URL.
 *
 * Still a static list. `GET /categories` returns this same shape and the header will read it
 * once the dropdowns need per-category counts; until then a request on every page render buys
 * nothing, because these six grades and ten tool categories are the ones that exist.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavColumn {
  heading: string;
  links: readonly NavLink[];
}

export interface NavItem {
  label: string;
  href: string;
  /** Present means the item opens a panel — on click, never on hover (DESIGN.md §4.1). */
  columns?: readonly NavColumn[];
}

export interface GradeNavEntry {
  /** The `grade` reference table's code, which is what a URL carries (FR-CAT-07). */
  code: string;
  label: string;
}

/**
 * The headline kit grades, ordered the way a builder progresses rather than alphabetically —
 * the same order the `grade` table's `position` gives the filter rail.
 *
 * Six of the eleven grades. MGEX, FM, RE100, HIRM and MEGA are real and filterable, they are
 * just too obscure to spend a menu slot on; "All grades" leads to the rail that lists them.
 *
 * Duplicating the labels here is the same trade the nav below already makes: a request on every
 * render to learn that Real Grade is called "Real Grade" buys nothing. It is exported because
 * the listing page titles itself from the selected grade, and two spellings of "Master Grade"
 * would be one more thing to keep in step.
 */
export const GRADE_NAV: readonly GradeNavEntry[] = [
  { code: 'EG', label: 'Entry Grade' },
  { code: 'SD', label: 'Super Deformed' },
  { code: 'HG', label: 'High Grade' },
  { code: 'RG', label: 'Real Grade' },
  { code: 'MG', label: 'Master Grade' },
  { code: 'PG', label: 'Perfect Grade' },
];

/** The browse URL for one grade. One place, so the menu and the heading cannot disagree. */
export function gradeHref(code: string): string {
  return `/kits?grade=${encodeURIComponent(code)}`;
}

/** `null` for a grade with no menu entry — MGEX is filterable but has no headline label here. */
export function gradeNavLabel(code: string): string | null {
  return GRADE_NAV.find((grade) => grade.code === code)?.label ?? null;
}

/** Two columns, max two levels. Deeper menus are a sign the taxonomy is wrong. */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    label: 'Kits',
    href: '/kits',
    columns: [
      {
        heading: 'By grade',
        links: [
          ...GRADE_NAV.map((grade) => ({ label: grade.label, href: gradeHref(grade.code) })),
          // The rail on `/kits` lists all eleven; the six above are the ones worth a menu slot.
          { label: 'All grades', href: '/kits' },
        ],
      },
      {
        heading: 'By series',
        links: [
          { label: 'Universal Century', href: '/kits?series=universal-century' },
          { label: 'Iron-Blooded Orphans', href: '/kits?series=iron-blooded-orphans' },
          { label: 'Gundam SEED', href: '/kits?series=gundam-seed' },
          { label: 'Mobile Suit Gundam 00', href: '/kits?series=gundam-00' },
          { label: 'The Witch from Mercury', href: '/kits?series=witch-from-mercury' },
        ],
      },
    ],
  },
  {
    label: 'Tools',
    href: '/tools',
    columns: [
      {
        heading: 'Cutting and trimming',
        links: [
          { label: 'Nippers', href: '/tools-nippers' },
          { label: 'Hobby knives', href: '/tools-hobby-knives' },
          { label: 'Files and sanding', href: '/tools-files-sanding' },
        ],
      },
      {
        heading: 'Finishing',
        links: [
          { label: 'Panel liners', href: '/tools-panel-liners' },
          { label: 'Topcoats', href: '/tools-topcoats' },
          { label: 'Markers and paint', href: '/tools-markers-paint' },
          { label: 'Decal supplies', href: '/tools-decal-supplies' },
        ],
      },
    ],
  },
  { label: 'Bundles', href: '/bundles' },
  { label: 'Guides', href: '/guides' },
];

/** The mobile tab bar (DESIGN.md §3.3). Five destinations, no more — a sixth stops being
 *  thumb-reachable. */
export const TAB_BAR_ITEMS = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Shop', href: '/kits', icon: 'shop' },
  { label: 'Cart', href: '/cart', icon: 'cart' },
  { label: 'Orders', href: '/orders', icon: 'orders' },
  { label: 'More', href: '/more', icon: 'more' },
] as const;

export type TabIcon = (typeof TAB_BAR_ITEMS)[number]['icon'];

/** Rotates on page load, never while focused (DESIGN.md §4.1). Real examples, so the search
 *  box teaches what the catalogue contains. */
export const SEARCH_PLACEHOLDERS = [
  'RX-78-2',
  'Master Grade',
  'panel liner',
  '1/100 Barbatos',
  'God Hand nipper',
] as const;
