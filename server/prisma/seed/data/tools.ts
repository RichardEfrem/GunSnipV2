import type { ToolJob } from '@gunsnip/shared';

/**
 * Tool and supply catalogue.
 *
 * Tool-specific specs live in `attributes` (PRD §5.1) because they have almost nothing in
 * common between lines — a grit number and a nozzle diameter do not belong in the same
 * column. Kits get first-class columns for exactly the opposite reason.
 */

/**
 * JSON that Prisma will accept as a `Json` column value. `Record<string, unknown>` is not
 * assignable to Prisma's `InputJsonValue` — `unknown` could be a function or a Date, neither
 * of which survives a round trip — so the seed states what it actually stores.
 */
type JsonValue = string | number | boolean | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type ProductAttributes = Readonly<Record<string, JsonValue>>;

export interface VariantSeed {
  sku: string;
  /** Only shown when a product has more than one variant. */
  name?: string;
  optionValues?: Record<string, string>;
  priceIdr: number;
  compareAtPriceIdr?: number;
  stockOnHand: number;
  weightGrams: number;
}

export interface ToolSeed {
  slug: string;
  name: string;
  brandSlug: string;
  categorySlug: string;
  job: ToolJob;
  description: string;
  tags: readonly string[];
  attributes: ProductAttributes;
  variants: readonly VariantSeed[];
}

export const TOOLS: readonly ToolSeed[] = [
  {
    slug: 'god-hand-spn-120-ultimate-nipper',
    name: 'God Hand SPN-120 Ultimate Nipper',
    brandSlug: 'god-hand',
    categorySlug: 'tools-nippers',
    job: 'CUTTING',
    description:
      'A single-bladed nipper that shears rather than pinches, so the gate leaves almost no white stress mark. Expensive, and the reason people stop sanding nubs.',
    tags: ['nipper', 'cutter', 'single blade', 'gate'],
    attributes: { bladeType: 'single', bladeAngleDeg: 5, plasticOnly: true, lengthMm: 120 },
    variants: [{ sku: 'GH-SPN120', priceIdr: 985000, stockOnHand: 14, weightGrams: 70 }],
  },
  {
    slug: 'dspiae-st-a-single-blade-nipper',
    name: 'DSPIAE ST-A Single Blade Nipper',
    brandSlug: 'dspiae',
    categorySlug: 'tools-nippers',
    job: 'CUTTING',
    description:
      'Most of the God Hand result at half the price. The blade is slightly thicker, so a second pass with a knife is still worth it on dark plastic.',
    tags: ['nipper', 'cutter', 'single blade', 'budget'],
    attributes: { bladeType: 'single', bladeAngleDeg: 7, plasticOnly: true, lengthMm: 118 },
    variants: [{ sku: 'DS-STA', priceIdr: 465000, compareAtPriceIdr: 545000, stockOnHand: 26, weightGrams: 68 }],
  },
  {
    slug: 'tamiya-sharp-pointed-side-cutter',
    name: 'Tamiya Sharp Pointed Side Cutter',
    brandSlug: 'tamiya',
    categorySlug: 'tools-nippers',
    job: 'CUTTING',
    description: 'The standard double-bladed nipper. Durable, forgiving, and the sensible first nipper.',
    tags: ['nipper', 'cutter', 'double blade', 'beginner'],
    attributes: { bladeType: 'double', plasticOnly: true, lengthMm: 125 },
    variants: [{ sku: 'TAM-74035', priceIdr: 385000, stockOnHand: 42, weightGrams: 85 }],
  },
  {
    slug: 'tamiya-modelers-knife',
    name: "Tamiya Modeler's Knife",
    brandSlug: 'tamiya',
    categorySlug: 'tools-hobby-knives',
    job: 'CUTTING',
    description: 'For the second pass on a nub, and for opening the box. Blades are consumable — buy spares.',
    tags: ['knife', 'blade', 'nub', 'trimming'],
    attributes: { handleMaterial: 'aluminium', bladeCompatibility: '#11' },
    variants: [
      { sku: 'TAM-74040-STD', name: 'With 25 blades', optionValues: { pack: 'With 25 blades' }, priceIdr: 145000, stockOnHand: 30, weightGrams: 60 },
      { sku: 'TAM-74040-BASIC', name: 'Handle only', optionValues: { pack: 'Handle only' }, priceIdr: 95000, stockOnHand: 18, weightGrams: 40 },
    ],
  },
  {
    slug: 'olfa-art-knife-pro',
    name: 'Olfa Art Knife Pro',
    brandSlug: 'tamiya',
    categorySlug: 'tools-hobby-knives',
    job: 'CUTTING',
    description: 'A heavier handle with a rotating chuck. Better balance for long trimming sessions.',
    tags: ['knife', 'blade', 'precision'],
    attributes: { handleMaterial: 'aluminium', bladeCompatibility: 'AK-4' },
    variants: [{ sku: 'OLF-AKPRO', priceIdr: 185000, stockOnHand: 12, weightGrams: 75 }],
  },
  {
    slug: 'god-hand-kamiyasu-sanding-stick',
    name: 'God Hand Kamiyasu Sanding Stick',
    brandSlug: 'god-hand',
    categorySlug: 'tools-files-sanding',
    job: 'SHAPING',
    description: 'Adhesive sanding film on a 3mm foam core. Flexes into curves without rounding an edge.',
    tags: ['sanding', 'file', 'grit', 'nub'],
    attributes: { thicknessMm: 3, backing: 'foam', sheetCount: 10 },
    variants: [
      { sku: 'GH-KS3-400', name: '#400', optionValues: { grit: '400' }, priceIdr: 78000, stockOnHand: 40, weightGrams: 25 },
      { sku: 'GH-KS3-600', name: '#600', optionValues: { grit: '600' }, priceIdr: 78000, stockOnHand: 36, weightGrams: 25 },
      { sku: 'GH-KS3-800', name: '#800', optionValues: { grit: '800' }, priceIdr: 78000, stockOnHand: 4, weightGrams: 25 },
      { sku: 'GH-KS3-1000', name: '#1000', optionValues: { grit: '1000' }, priceIdr: 82000, stockOnHand: 22, weightGrams: 25 },
    ],
  },
  {
    slug: 'tamiya-sanding-sponge-sheet',
    name: 'Tamiya Sanding Sponge Sheet',
    brandSlug: 'tamiya',
    categorySlug: 'tools-files-sanding',
    job: 'SHAPING',
    description: 'Sponge-backed abrasive that follows a curved surface. Washable, so one sheet lasts several kits.',
    tags: ['sanding', 'sponge', 'grit', 'curved'],
    attributes: { thicknessMm: 2, backing: 'sponge', washable: true },
    variants: [
      { sku: 'TAM-SS-400', name: '#400', optionValues: { grit: '400' }, priceIdr: 42000, stockOnHand: 55, weightGrams: 20 },
      { sku: 'TAM-SS-600', name: '#600', optionValues: { grit: '600' }, priceIdr: 42000, stockOnHand: 48, weightGrams: 20 },
      { sku: 'TAM-SS-1000', name: '#1000', optionValues: { grit: '1000' }, priceIdr: 45000, stockOnHand: 31, weightGrams: 20 },
      { sku: 'TAM-SS-1500', name: '#1500', optionValues: { grit: '1500' }, priceIdr: 45000, stockOnHand: 0, weightGrams: 20 },
    ],
  },
  {
    slug: 'dspiae-glass-file',
    name: 'DSPIAE Glass File',
    brandSlug: 'dspiae',
    categorySlug: 'tools-files-sanding',
    job: 'SHAPING',
    description: 'Etched glass, so it never loads up and never wears out. Aggressive — finish with 800 or higher.',
    tags: ['file', 'glass', 'nub'],
    attributes: { material: 'glass', lengthMm: 150, equivalentGrit: 400 },
    variants: [{ sku: 'DS-GF150', priceIdr: 225000, stockOnHand: 9, weightGrams: 55 }],
  },
  {
    slug: 'tamiya-panel-line-accent-color',
    name: 'Tamiya Panel Line Accent Color',
    brandSlug: 'tamiya',
    categorySlug: 'tools-panel-liners',
    job: 'FINISHING',
    description:
      'Pre-thinned enamel wash with a brush in the cap. Flows into a panel line by capillary action; wipe the excess with a cotton bud.',
    tags: ['panel liner', 'wash', 'enamel', 'lining'],
    attributes: { base: 'enamel', volumeMl: 40, applicator: 'brush-in-cap' },
    variants: [
      { sku: 'TAM-PLA-BLK', name: 'Black', optionValues: { colour: 'Black' }, priceIdr: 95000, stockOnHand: 64, weightGrams: 60 },
      { sku: 'TAM-PLA-GRY', name: 'Grey', optionValues: { colour: 'Grey' }, priceIdr: 95000, stockOnHand: 41, weightGrams: 60 },
      { sku: 'TAM-PLA-BRN', name: 'Brown', optionValues: { colour: 'Brown' }, priceIdr: 95000, stockOnHand: 28, weightGrams: 60 },
      { sku: 'TAM-PLA-DBR', name: 'Dark Brown', optionValues: { colour: 'Dark Brown' }, priceIdr: 98000, stockOnHand: 2, weightGrams: 60 },
    ],
  },
  {
    slug: 'gundam-marker-panel-liner',
    name: 'Gundam Marker Panel Lining Pen',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-panel-liners',
    job: 'FINISHING',
    description: 'The no-mess option. Less depth than an enamel wash, but nothing to thin and nothing to spill.',
    tags: ['panel liner', 'marker', 'beginner', 'lining'],
    attributes: { base: 'alcohol', applicator: 'fine-tip pen', tipMm: 0.5 },
    variants: [
      { sku: 'GM-PL-BLK', name: 'Black', optionValues: { colour: 'Black' }, priceIdr: 48000, stockOnHand: 80, weightGrams: 15 },
      { sku: 'GM-PL-GRY', name: 'Grey', optionValues: { colour: 'Grey' }, priceIdr: 48000, stockOnHand: 72, weightGrams: 15 },
      { sku: 'GM-PL-BRN', name: 'Brown', optionValues: { colour: 'Brown' }, priceIdr: 48000, stockOnHand: 35, weightGrams: 15 },
    ],
  },
  {
    slug: 'mr-hobby-mr-super-clear',
    name: 'Mr. Hobby Mr. Super Clear',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-topcoats',
    job: 'FINISHING',
    description:
      'Lacquer topcoat in a can. Kills the plastic shine and seals decals. Ventilate properly, and never spray it on a humid day — it blooms white.',
    tags: ['topcoat', 'spray', 'lacquer', 'matte', 'finish'],
    attributes: { base: 'lacquer', volumeMl: 170, format: 'aerosol' },
    variants: [
      { sku: 'MH-MSC-FLAT', name: 'Flat', optionValues: { finish: 'Flat' }, priceIdr: 165000, stockOnHand: 33, weightGrams: 300 },
      { sku: 'MH-MSC-SEMI', name: 'Semi-gloss', optionValues: { finish: 'Semi-gloss' }, priceIdr: 165000, stockOnHand: 21, weightGrams: 300 },
      { sku: 'MH-MSC-GLOSS', name: 'Gloss', optionValues: { finish: 'Gloss' }, priceIdr: 165000, stockOnHand: 17, weightGrams: 300 },
    ],
  },
  {
    slug: 'mr-hobby-mr-top-coat',
    name: 'Mr. Hobby Mr. Top Coat',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-topcoats',
    job: 'FINISHING',
    description: 'Water-based topcoat. Safer over markers and stickers than lacquer, and far less smell.',
    tags: ['topcoat', 'spray', 'water based', 'finish'],
    attributes: { base: 'acrylic', volumeMl: 88, format: 'aerosol' },
    variants: [
      { sku: 'MH-MTC-FLAT', name: 'Flat', optionValues: { finish: 'Flat' }, priceIdr: 135000, stockOnHand: 26, weightGrams: 180 },
      { sku: 'MH-MTC-SEMI', name: 'Semi-gloss', optionValues: { finish: 'Semi-gloss' }, priceIdr: 135000, stockOnHand: 14, weightGrams: 180 },
    ],
  },
  {
    slug: 'gundam-marker-basic-set',
    name: 'Gundam Marker Basic Set',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-markers-paint',
    job: 'PAINTING',
    description: 'Six markers covering the detail colours most kits ask for. No airbrush, no thinner, no cleanup.',
    tags: ['marker', 'paint', 'beginner', 'detail'],
    attributes: { pieces: 6, base: 'alcohol' },
    variants: [{ sku: 'GM-SET-BASIC', priceIdr: 195000, stockOnHand: 24, weightGrams: 120 }],
  },
  {
    slug: 'mr-color-lacquer-paint',
    name: 'Mr. Color Lacquer Paint',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-markers-paint',
    job: 'PAINTING',
    description: 'The airbrush standard. Thins with lacquer thinner, cures hard, and sands cleanly.',
    tags: ['paint', 'lacquer', 'airbrush', 'colour'],
    attributes: { base: 'lacquer', volumeMl: 10, finish: 'gloss' },
    variants: [
      { sku: 'MC-008', name: 'C8 Silver', optionValues: { colour: 'C8 Silver' }, priceIdr: 38000, stockOnHand: 60, weightGrams: 25 },
      { sku: 'MC-001', name: 'C1 White', optionValues: { colour: 'C1 White' }, priceIdr: 35000, stockOnHand: 58, weightGrams: 25 },
      { sku: 'MC-002', name: 'C2 Black', optionValues: { colour: 'C2 Black' }, priceIdr: 35000, stockOnHand: 52, weightGrams: 25 },
      { sku: 'MC-003', name: 'C3 Red', optionValues: { colour: 'C3 Red' }, priceIdr: 35000, stockOnHand: 44, weightGrams: 25 },
      { sku: 'MC-005', name: 'C5 Blue', optionValues: { colour: 'C5 Blue' }, priceIdr: 35000, stockOnHand: 3, weightGrams: 25 },
    ],
  },
  {
    slug: 'gaia-notes-surface-primer',
    name: 'Gaia Notes Surface Primer',
    brandSlug: 'gaia-notes',
    categorySlug: 'tools-markers-paint',
    job: 'PAINTING',
    description: 'Fine grey primer that shows every seam you missed, which is the point.',
    tags: ['primer', 'paint', 'surface'],
    attributes: { base: 'lacquer', volumeMl: 180, format: 'aerosol', colour: 'grey' },
    variants: [{ sku: 'GN-PRIM-GRY', priceIdr: 175000, stockOnHand: 11, weightGrams: 320 }],
  },
  {
    slug: 'tamiya-extra-thin-cement',
    name: 'Tamiya Extra Thin Cement',
    brandSlug: 'tamiya',
    categorySlug: 'tools-adhesives',
    job: 'ADHESIVE',
    description: 'Runs into a seam by capillary action and welds the plastic. For seam lines, not for snap-fit joints.',
    tags: ['cement', 'glue', 'seam', 'adhesive'],
    attributes: { base: 'solvent', volumeMl: 40, applicator: 'brush-in-cap', quickSetting: false },
    variants: [
      { sku: 'TAM-87038', name: 'Standard', optionValues: { type: 'Standard' }, priceIdr: 78000, stockOnHand: 38, weightGrams: 65 },
      { sku: 'TAM-87182', name: 'Quick setting', optionValues: { type: 'Quick setting' }, priceIdr: 85000, stockOnHand: 19, weightGrams: 65 },
    ],
  },
  {
    slug: 'mr-hobby-mr-cement-s',
    name: 'Mr. Hobby Mr. Cement S',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-adhesives',
    job: 'ADHESIVE',
    description: 'Thinner and faster than Extra Thin. Good on small parts where a slow set means a moved part.',
    tags: ['cement', 'glue', 'adhesive'],
    attributes: { base: 'solvent', volumeMl: 40, applicator: 'brush-in-cap', quickSetting: true },
    variants: [{ sku: 'MH-MC129', priceIdr: 72000, stockOnHand: 27, weightGrams: 60 }],
  },
  {
    slug: 'mr-hobby-mr-mark-setter',
    name: 'Mr. Hobby Mr. Mark Setter',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-decal-supplies',
    job: 'DECAL_AIDS',
    description:
      'Brushed under a waterslide decal before it goes down. Adds grip and lets the film settle onto a curve without silvering.',
    tags: ['decal', 'waterslide', 'setter'],
    attributes: { volumeMl: 40, applicator: 'brush-in-cap', usedBefore: true },
    variants: [{ sku: 'MH-MS231', priceIdr: 65000, stockOnHand: 34, weightGrams: 55 }],
  },
  {
    slug: 'mr-hobby-mr-mark-softer',
    name: 'Mr. Hobby Mr. Mark Softer',
    brandSlug: 'mr-hobby',
    categorySlug: 'tools-decal-supplies',
    job: 'DECAL_AIDS',
    description: 'Brushed over a placed decal to soften it into panel lines. Do not touch it while it works.',
    tags: ['decal', 'waterslide', 'softer'],
    attributes: { volumeMl: 40, applicator: 'brush-in-cap', usedBefore: false },
    variants: [{ sku: 'MH-MS232', priceIdr: 65000, stockOnHand: 29, weightGrams: 55 }],
  },
  {
    slug: 'tamiya-reverse-action-tweezers',
    name: 'Tamiya Reverse-Action Tweezers',
    brandSlug: 'tamiya',
    categorySlug: 'tools-decal-supplies',
    job: 'DECAL_AIDS',
    description: 'Grips when relaxed, so it holds a decal or a tiny part without hand fatigue.',
    tags: ['tweezers', 'decal', 'precision'],
    attributes: { lengthMm: 120, tip: 'fine', reverseAction: true },
    variants: [{ sku: 'TAM-74093', priceIdr: 118000, stockOnHand: 23, weightGrams: 30 }],
  },
  {
    slug: 'bandai-action-base-5',
    name: 'Bandai Action Base 5',
    brandSlug: 'bandai-spirits',
    categorySlug: 'tools-display',
    job: 'DISPLAY',
    description: 'Adjustable stand for 1/144 and most 1/100 kits. The only way to display a flight pose.',
    tags: ['stand', 'display', 'action base'],
    attributes: { supports: ['1/144', '1/100'], adjustable: true },
    variants: [
      { sku: 'BAN-AB5-BLK', name: 'Black', optionValues: { colour: 'Black' }, priceIdr: 145000, stockOnHand: 46, weightGrams: 210 },
      { sku: 'BAN-AB5-CLR', name: 'Clear', optionValues: { colour: 'Clear' }, priceIdr: 155000, stockOnHand: 5, weightGrams: 210 },
    ],
  },
  {
    slug: 'wave-display-case-medium',
    name: 'Wave Display Case (Medium)',
    brandSlug: 'wave',
    categorySlug: 'tools-display',
    job: 'DISPLAY',
    description: 'Acrylic case sized for a built Master Grade. Dust is what actually ruins a finished kit.',
    tags: ['case', 'display', 'acrylic', 'dust'],
    attributes: { widthMm: 200, depthMm: 200, heightMm: 320, material: 'acrylic' },
    variants: [{ sku: 'WV-CASE-M', priceIdr: 485000, stockOnHand: 7, weightGrams: 1400 }],
  },
  {
    slug: 'tamiya-cutting-mat-a4',
    name: 'Tamiya Cutting Mat A4',
    brandSlug: 'tamiya',
    categorySlug: 'tools-workspace',
    job: 'WORKSPACE',
    description: 'Self-healing mat with a printed grid. Protects the table and stops small parts rolling away.',
    tags: ['mat', 'workspace', 'cutting'],
    attributes: { size: 'A4', selfHealing: true, thicknessMm: 3 },
    variants: [{ sku: 'TAM-74076', priceIdr: 165000, stockOnHand: 31, weightGrams: 380 }],
  },
  {
    slug: 'dspiae-led-magnifier-lamp',
    name: 'DSPIAE LED Magnifier Lamp',
    brandSlug: 'dspiae',
    categorySlug: 'tools-workspace',
    job: 'WORKSPACE',
    description: 'Clamp lamp with a 3× lens. Most "my panel lining is messy" problems are actually lighting problems.',
    tags: ['lamp', 'magnifier', 'workspace', 'light'],
    attributes: { magnification: '3x', powerSource: 'USB-C', dimmable: true },
    variants: [{ sku: 'DS-LAMP-3X', priceIdr: 685000, compareAtPriceIdr: 795000, stockOnHand: 6, weightGrams: 900 }],
  },
  {
    slug: 'dspiae-parts-storage-tray',
    name: 'DSPIAE Parts Storage Tray',
    brandSlug: 'dspiae',
    categorySlug: 'tools-display',
    job: 'STORAGE',
    description: 'Six compartments with a lid, for the parts you cut off before you need them.',
    tags: ['storage', 'tray', 'parts'],
    attributes: { compartments: 6, stackable: true },
    variants: [{ sku: 'DS-TRAY6', priceIdr: 125000, stockOnHand: 18, weightGrams: 240 }],
  },
  {
    slug: 'god-hand-nub-polishing-set',
    name: 'God Hand Nub Polishing Set',
    brandSlug: 'god-hand',
    categorySlug: 'tools-files-sanding',
    job: 'SHAPING',
    description: 'Graduated cloth pads from 2000 to 6000 for bringing a sanded nub back to the surrounding gloss.',
    tags: ['polishing', 'sanding', 'nub', 'finish'],
    attributes: { gritRange: '2000-6000', pieces: 4, backing: 'cloth' },
    variants: [{ sku: 'GH-POLISH4', priceIdr: 215000, stockOnHand: 13, weightGrams: 45 }],
  },
];
