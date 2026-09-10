import type { ProductType } from '@gunsnip/shared';

/**
 * Reference data (FR-ADM-09). Codes are the stable keys the seed, the URLs and the filter
 * rail use; names and descriptions are copy the operator may rewrite without breaking either.
 */

export interface GradeSeed {
  code: string;
  name: string;
  description: string;
  position: number;
}

/** Ordered the way a builder progresses, not alphabetically — this is the filter rail order. */
export const GRADES: readonly GradeSeed[] = [
  { code: 'EG', name: 'Entry Grade', description: 'Snap-fit, no nippers strictly needed, coloured plastic. About an hour.', position: 10 },
  { code: 'SD', name: 'Super Deformed', description: 'Two-head-tall proportions. Cheap, quick, and forgiving of mistakes.', position: 20 },
  { code: 'HG', name: 'High Grade', description: '1/144 scale, moderate part count. The default way to buy a mobile suit.', position: 30 },
  { code: 'RG', name: 'Real Grade', description: '1/144 with an inner frame and MG-level detail. Small, fiddly, impressive.', position: 40 },
  { code: 'MG', name: 'Master Grade', description: '1/100 scale. Full inner frame, high part count, 8–20 hours.', position: 50 },
  { code: 'MGEX', name: 'Master Grade Extreme', description: 'Master Grade with a gimmick taken to excess — usually LEDs.', position: 60 },
  { code: 'PG', name: 'Perfect Grade', description: '1/60 scale, 600+ parts, internal frame and lighting. A project, not a weekend.', position: 70 },
  { code: 'FM', name: 'Full Mechanics', description: '1/100 with a partial frame. Between HG and MG in both price and effort.', position: 80 },
  { code: 'RE100', name: 'Reborn-One Hundred', description: '1/100 kits of designs too obscure for a full Master Grade treatment.', position: 90 },
  { code: 'HIRM', name: 'Hi-Resolution Model', description: 'Pre-painted die-cast frame under standard armour. Heavy and expensive.', position: 100 },
  { code: 'MEGA', name: 'Mega Size', description: '1/48. Very large, comparatively few parts, mostly a display piece.', position: 110 },
];

export interface ScaleSeed {
  code: string;
  name: string;
  position: number;
}

export const SCALES: readonly ScaleSeed[] = [
  { code: '1/144', name: '1/144', position: 10 },
  { code: '1/100', name: '1/100', position: 20 },
  { code: '1/72', name: '1/72', position: 30 },
  { code: '1/60', name: '1/60', position: 40 },
  { code: '1/48', name: '1/48', position: 50 },
  { code: 'NON_SCALE', name: 'Non-scale', position: 60 },
];

export interface SeriesSeed {
  name: string;
  slug: string;
  position: number;
}

export const SERIES: readonly SeriesSeed[] = [
  { name: 'Universal Century', slug: 'universal-century', position: 10 },
  { name: 'Gundam SEED', slug: 'gundam-seed', position: 20 },
  { name: 'Mobile Suit Gundam 00', slug: 'gundam-00', position: 30 },
  { name: 'Iron-Blooded Orphans', slug: 'iron-blooded-orphans', position: 40 },
  { name: 'Gundam Wing', slug: 'gundam-wing', position: 50 },
  { name: 'The Witch from Mercury', slug: 'witch-from-mercury', position: 60 },
  { name: 'Gundam Build Series', slug: 'gundam-build-series', position: 70 },
  { name: 'The Origin', slug: 'the-origin', position: 80 },
];

export interface BrandSeed {
  name: string;
  slug: string;
}

export const BRANDS: readonly BrandSeed[] = [
  { name: 'Bandai Spirits', slug: 'bandai-spirits' },
  { name: 'God Hand', slug: 'god-hand' },
  { name: 'Tamiya', slug: 'tamiya' },
  { name: 'Mr. Hobby', slug: 'mr-hobby' },
  { name: 'DSPIAE', slug: 'dspiae' },
  { name: 'Gaia Notes', slug: 'gaia-notes' },
  { name: 'Wave', slug: 'wave' },
];

export interface CategorySeed {
  name: string;
  slug: string;
  type: ProductType;
  position: number;
  children?: readonly CategorySeed[];
}

/**
 * Two trees, because kits and tools are browsed in completely different ways: a kit shopper
 * filters by grade and series, a tool shopper by the job they are trying to do.
 */
export const CATEGORIES: readonly CategorySeed[] = [
  {
    name: 'Kits',
    slug: 'kits',
    type: 'MODEL_KIT',
    position: 10,
    children: [
      { name: 'Entry Grade', slug: 'kits-eg', type: 'MODEL_KIT', position: 10 },
      { name: 'High Grade', slug: 'kits-hg', type: 'MODEL_KIT', position: 20 },
      { name: 'Real Grade', slug: 'kits-rg', type: 'MODEL_KIT', position: 30 },
      { name: 'Master Grade', slug: 'kits-mg', type: 'MODEL_KIT', position: 40 },
      { name: 'Perfect Grade', slug: 'kits-pg', type: 'MODEL_KIT', position: 50 },
      { name: 'SD and other', slug: 'kits-sd', type: 'MODEL_KIT', position: 60 },
    ],
  },
  {
    name: 'Tools and supplies',
    slug: 'tools',
    type: 'TOOL_SUPPLY',
    position: 20,
    children: [
      { name: 'Nippers', slug: 'tools-nippers', type: 'TOOL_SUPPLY', position: 10 },
      { name: 'Hobby knives', slug: 'tools-hobby-knives', type: 'TOOL_SUPPLY', position: 20 },
      { name: 'Files and sanding', slug: 'tools-files-sanding', type: 'TOOL_SUPPLY', position: 30 },
      { name: 'Panel liners', slug: 'tools-panel-liners', type: 'TOOL_SUPPLY', position: 40 },
      { name: 'Topcoats', slug: 'tools-topcoats', type: 'TOOL_SUPPLY', position: 50 },
      { name: 'Markers and paint', slug: 'tools-markers-paint', type: 'TOOL_SUPPLY', position: 60 },
      { name: 'Cement and adhesives', slug: 'tools-adhesives', type: 'TOOL_SUPPLY', position: 70 },
      { name: 'Decal supplies', slug: 'tools-decal-supplies', type: 'TOOL_SUPPLY', position: 80 },
      { name: 'Display and storage', slug: 'tools-display', type: 'TOOL_SUPPLY', position: 90 },
      { name: 'Workspace', slug: 'tools-workspace', type: 'TOOL_SUPPLY', position: 100 },
    ],
  },
];

/**
 * Terms customers type that FTS alone would miss (FR-SRCH-04) — nicknames, the Greek letter
 * people cannot type, model numbers used instead of names, and the two spellings of "grey".
 */
export const SEARCH_SYNONYMS: readonly { term: string; expansions: readonly string[] }[] = [
  { term: 'nu gundam', expansions: ['rx-93', 'ν gundam', 'nu'] },
  { term: 'v gundam', expansions: ['rx-93', 'nu gundam'] },
  { term: 'unicorn', expansions: ['rx-0', 'unicorn gundam', 'banshee'] },
  { term: 'barbatos', expansions: ['asw-g-08', 'iron-blooded orphans', 'ibo'] },
  { term: 'ibo', expansions: ['iron-blooded orphans', 'barbatos', 'gusion'] },
  { term: 'zaku', expansions: ['ms-06', 'ms-06s', 'char zaku'] },
  { term: 'char', expansions: ['ms-06s', 'sazabi', 'msn-04', 'red comet'] },
  { term: 'sazabi', expansions: ['msn-04', 'char'] },
  { term: 'strike freedom', expansions: ['zgmf-x20a', 'seed'] },
  { term: 'exia', expansions: ['gn-001', 'gundam 00'] },
  { term: 'aerial', expansions: ['xvx-016', 'witch from mercury'] },
  { term: 'wing zero', expansions: ['xxxg-00w0', 'endless waltz'] },
  { term: 'nipper', expansions: ['nippers', 'cutter', 'side cutter'] },
  { term: 'panel liner', expansions: ['panel line accent color', 'gundam marker', 'lining'] },
  { term: 'topcoat', expansions: ['top coat', 'clear coat', 'matte spray'] },
  { term: 'grey', expansions: ['gray'] },
  { term: 'gray', expansions: ['grey'] },
  { term: 'verka', expansions: ['ver.ka', 'version ka', 'katoki'] },
];
