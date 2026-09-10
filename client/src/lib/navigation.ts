/**
 * The header's navigation model (DESIGN.md §4.1).
 *
 * The hrefs are real category slugs, which are globally unique and already namespaced
 * (`kits-mg`, `tools-nippers`), so a category is one path segment at the root — see
 * `app/(storefront)/[category]/page.tsx`.
 *
 * Still a static list. `GET /categories` returns this same shape and the header will read it
 * once the dropdowns need per-category counts; until then a request on every page render buys
 * nothing, because these six grades and ten tool categories are the ones that exist. The series
 * links are filter URLs rather than categories — series is a facet, not a branch of the tree.
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

/** Two columns, max two levels. Deeper menus are a sign the taxonomy is wrong. */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    label: 'Kits',
    href: '/kits',
    columns: [
      {
        heading: 'By grade',
        links: [
          { label: 'Entry Grade', href: '/kits-eg' },
          { label: 'High Grade', href: '/kits-hg' },
          { label: 'Real Grade', href: '/kits-rg' },
          { label: 'Master Grade', href: '/kits-mg' },
          { label: 'Perfect Grade', href: '/kits-pg' },
          { label: 'SD and other', href: '/kits-sd' },
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
