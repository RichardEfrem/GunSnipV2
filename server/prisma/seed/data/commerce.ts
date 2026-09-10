import type { Necessity, VoucherType } from '@gunsnip/shared';

/**
 * What a kit of each grade needs on the bench (PRD §5.3, FR-PDP-08).
 *
 * Curated per grade rather than per product, because the answer is genuinely a property of the
 * grade: every Real Grade has waterslide decals and tiny parts, every Entry Grade has neither.
 * The seed copies these onto each kit, and `product_requirement` rows are then editable per
 * product (FR-ADM-06) — so a kit that breaks the pattern is a row edit, not a schema problem.
 */
export interface GradeToolDefaultSeed {
  gradeCode: string;
  toolSlug: string;
  necessity: Necessity;
  reason?: string;
  position: number;
}

/** The three tools almost every build touches, referenced repeatedly below. */
const NIPPER = 'tamiya-sharp-pointed-side-cutter';
const KNIFE = 'tamiya-modelers-knife';
const SANDING = 'tamiya-sanding-sponge-sheet';
const LINER = 'tamiya-panel-line-accent-color';
const MARKER_LINER = 'gundam-marker-panel-liner';
const SETTER = 'mr-hobby-mr-mark-setter';
const TOPCOAT = 'mr-hobby-mr-top-coat';
const LACQUER_TOPCOAT = 'mr-hobby-mr-super-clear';
const TWEEZERS = 'tamiya-reverse-action-tweezers';
const STAND = 'bandai-action-base-5';
const CASE = 'wave-display-case-medium';
const MAT = 'tamiya-cutting-mat-a4';

export const GRADE_TOOL_DEFAULTS: readonly GradeToolDefaultSeed[] = [
  // Entry Grade is designed to need nothing. Saying otherwise here would undercut the one
  // grade whose entire promise is "no tools".
  { gradeCode: 'EG', toolSlug: NIPPER, necessity: 'OPTIONAL', reason: 'Parts separate by hand, but a nipper leaves a cleaner edge.', position: 10 },
  { gradeCode: 'EG', toolSlug: MARKER_LINER, necessity: 'OPTIONAL', reason: 'The quickest way to make a plain kit look finished.', position: 20 },

  { gradeCode: 'SD', toolSlug: NIPPER, necessity: 'REQUIRED', reason: 'Parts are attached to runners and have to be cut off.', position: 10 },
  { gradeCode: 'SD', toolSlug: KNIFE, necessity: 'RECOMMENDED', reason: 'Trims the leftover nub flush.', position: 20 },
  { gradeCode: 'SD', toolSlug: MARKER_LINER, necessity: 'OPTIONAL', position: 30 },

  { gradeCode: 'HG', toolSlug: NIPPER, necessity: 'REQUIRED', reason: 'Parts are attached to runners and have to be cut off.', position: 10 },
  { gradeCode: 'HG', toolSlug: KNIFE, necessity: 'RECOMMENDED', reason: 'Trims the leftover nub flush.', position: 20 },
  { gradeCode: 'HG', toolSlug: LINER, necessity: 'RECOMMENDED', reason: 'High Grade panel lines are moulded deep enough to hold a wash.', position: 30 },
  { gradeCode: 'HG', toolSlug: MAT, necessity: 'OPTIONAL', position: 40 },

  { gradeCode: 'RG', toolSlug: NIPPER, necessity: 'REQUIRED', reason: 'Real Grade parts are small and snap if you twist them off.', position: 10 },
  { gradeCode: 'RG', toolSlug: KNIFE, necessity: 'REQUIRED', reason: 'Nubs on parts this small cannot be sanded without a knife pass first.', position: 20 },
  { gradeCode: 'RG', toolSlug: SANDING, necessity: 'RECOMMENDED', position: 30 },
  { gradeCode: 'RG', toolSlug: TWEEZERS, necessity: 'RECOMMENDED', reason: 'Several parts are too small to place by hand.', position: 40 },
  { gradeCode: 'RG', toolSlug: LINER, necessity: 'RECOMMENDED', position: 50 },

  { gradeCode: 'MG', toolSlug: NIPPER, necessity: 'REQUIRED', reason: 'Parts are attached to runners and have to be cut off.', position: 10 },
  { gradeCode: 'MG', toolSlug: KNIFE, necessity: 'REQUIRED', reason: 'Trims the leftover nub flush.', position: 20 },
  { gradeCode: 'MG', toolSlug: SANDING, necessity: 'RECOMMENDED', reason: 'Master Grade armour shows nub marks on flat panels.', position: 30 },
  { gradeCode: 'MG', toolSlug: LINER, necessity: 'RECOMMENDED', position: 40 },
  { gradeCode: 'MG', toolSlug: TOPCOAT, necessity: 'RECOMMENDED', reason: 'Seals decals and kills the plastic shine.', position: 50 },
  { gradeCode: 'MG', toolSlug: MAT, necessity: 'OPTIONAL', position: 60 },

  { gradeCode: 'MGEX', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'MGEX', toolSlug: KNIFE, necessity: 'REQUIRED', position: 20 },
  { gradeCode: 'MGEX', toolSlug: SANDING, necessity: 'RECOMMENDED', position: 30 },
  { gradeCode: 'MGEX', toolSlug: TWEEZERS, necessity: 'RECOMMENDED', reason: 'The fibre-optic runs need placing with tweezers.', position: 40 },
  { gradeCode: 'MGEX', toolSlug: TOPCOAT, necessity: 'RECOMMENDED', position: 50 },

  { gradeCode: 'PG', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'PG', toolSlug: KNIFE, necessity: 'REQUIRED', position: 20 },
  { gradeCode: 'PG', toolSlug: SANDING, necessity: 'REQUIRED', reason: 'At 1/60 a nub mark is visible from across the room.', position: 30 },
  { gradeCode: 'PG', toolSlug: TWEEZERS, necessity: 'RECOMMENDED', position: 40 },
  { gradeCode: 'PG', toolSlug: LACQUER_TOPCOAT, necessity: 'RECOMMENDED', reason: 'A kit this size deserves a sealed finish.', position: 50 },
  { gradeCode: 'PG', toolSlug: CASE, necessity: 'RECOMMENDED', reason: 'Dust is what actually ruins a finished Perfect Grade.', position: 60 },
  { gradeCode: 'PG', toolSlug: MAT, necessity: 'RECOMMENDED', position: 70 },

  { gradeCode: 'FM', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'FM', toolSlug: KNIFE, necessity: 'RECOMMENDED', position: 20 },
  { gradeCode: 'FM', toolSlug: LINER, necessity: 'RECOMMENDED', position: 30 },

  { gradeCode: 'RE100', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'RE100', toolSlug: KNIFE, necessity: 'RECOMMENDED', position: 20 },
  { gradeCode: 'RE100', toolSlug: SANDING, necessity: 'RECOMMENDED', position: 30 },
  { gradeCode: 'RE100', toolSlug: LINER, necessity: 'RECOMMENDED', position: 40 },

  { gradeCode: 'HIRM', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'HIRM', toolSlug: KNIFE, necessity: 'RECOMMENDED', position: 20 },
  { gradeCode: 'HIRM', toolSlug: TOPCOAT, necessity: 'OPTIONAL', reason: 'The frame is pre-painted, so only the armour needs sealing.', position: 30 },

  { gradeCode: 'MEGA', toolSlug: NIPPER, necessity: 'REQUIRED', position: 10 },
  { gradeCode: 'MEGA', toolSlug: KNIFE, necessity: 'RECOMMENDED', position: 20 },
  { gradeCode: 'MEGA', toolSlug: SANDING, necessity: 'RECOMMENDED', reason: 'Large flat panels show every imperfection.', position: 30 },
  { gradeCode: 'MEGA', toolSlug: LACQUER_TOPCOAT, necessity: 'OPTIONAL', position: 40 },
];

/**
 * Applied on top of the grade defaults to any kit whose `decalType` is WATERSLIDE. This is the
 * one requirement that is a property of the *kit* rather than the grade — an RG and an MG both
 * need it, an HG with foil stickers does not.
 */
export const WATERSLIDE_REQUIREMENT = {
  toolSlug: SETTER,
  necessity: 'REQUIRED' as Necessity,
  reason: 'Waterslide decals need setting solution.',
  position: 5,
};

/** A stand is needed by kits that genuinely cannot hold their own pose. */
export const STAND_REQUIRED_SLUGS: readonly string[] = [
  'hg-1-144-wing-gundam-zero-ew',
  'rg-1-144-wing-gundam-zero-ew',
  'rg-1-144-nu-gundam',
  'hg-1-144-strike-freedom',
];

export const STAND_REQUIREMENT = {
  toolSlug: STAND,
  necessity: 'RECOMMENDED' as Necessity,
  reason: 'The wings make this back-heavy; it will not stand unaided for long.',
  position: 45,
};

// ---------------------------------------------------------------------------- vouchers

export interface VoucherSeed {
  code: string;
  type: VoucherType;
  percentOff?: number;
  amountIdr?: number;
  minSpendIdr?: number;
  maxDiscountIdr?: number;
  /** Days from seed time. Negative starts in the past. */
  startsInDays: number;
  endsInDays: number;
  usageLimit?: number;
  perSessionLimit?: number;
  usedCount?: number;
  isActive?: boolean;
  description: string;
  /** Category slugs the voucher is limited to. Empty means the whole catalogue. */
  categorySlugs?: readonly string[];
}

/**
 * A deliberate spread of states, because the interesting work in Phase 10 is the *rejection*
 * path: every constraint in FR-PROMO-02 needs a voucher here that trips it, or the specific
 * rejection messages the cart owes the customer cannot be exercised.
 */
export const VOUCHERS: readonly VoucherSeed[] = [
  {
    code: 'WELCOME10',
    type: 'PERCENTAGE',
    percentOff: 10,
    minSpendIdr: 250000,
    maxDiscountIdr: 100000,
    startsInDays: -30,
    endsInDays: 90,
    perSessionLimit: 1,
    description: '10% off your first order over Rp 250.000, up to Rp 100.000.',
  },
  {
    code: 'FIRSTBUILD',
    type: 'FIXED_AMOUNT',
    amountIdr: 50000,
    minSpendIdr: 300000,
    startsInDays: -14,
    endsInDays: 60,
    perSessionLimit: 1,
    description: 'Rp 50.000 off a starter order over Rp 300.000.',
  },
  {
    code: 'GRATISONGKIR',
    type: 'FREE_SHIPPING',
    minSpendIdr: 500000,
    startsInDays: -7,
    endsInDays: 30,
    description: 'Free shipping on orders over Rp 500.000.',
  },
  {
    code: 'MASTERGRADE20',
    type: 'PERCENTAGE',
    percentOff: 20,
    maxDiscountIdr: 400000,
    startsInDays: -3,
    endsInDays: 21,
    categorySlugs: ['kits-mg'],
    description: '20% off Master Grade kits, up to Rp 400.000.',
  },
  // Expired: exercises "this voucher ended on …".
  {
    code: 'LEBARAN2025',
    type: 'PERCENTAGE',
    percentOff: 15,
    startsInDays: -400,
    endsInDays: -320,
    description: 'Expired seasonal promotion, kept to exercise the expiry rejection path.',
  },
  // Exhausted: exercises "this voucher has been fully claimed".
  {
    code: 'FLASH50',
    type: 'FIXED_AMOUNT',
    amountIdr: 150000,
    minSpendIdr: 1000000,
    startsInDays: -2,
    endsInDays: 14,
    usageLimit: 50,
    usedCount: 50,
    description: 'Fully redeemed flash promotion, kept to exercise the usage-limit rejection path.',
  },
  // Deactivated by the operator rather than expired — a different rejection reason again.
  {
    code: 'STAFFONLY',
    type: 'PERCENTAGE',
    percentOff: 30,
    startsInDays: -10,
    endsInDays: 365,
    isActive: false,
    description: 'Deactivated internal code, kept to exercise the inactive rejection path.',
  },
];

// ----------------------------------------------------------------- bundles and banners

export interface BundleSeed {
  slug: string;
  name: string;
  description: string;
  priceIdr: number;
  /** SKUs, so a bundle points at a specific variant rather than a product. */
  items: readonly { sku: string; quantity: number }[];
}

export const BUNDLES: readonly BundleSeed[] = [
  {
    slug: 'first-build-starter',
    name: 'First build starter',
    description: 'One Entry Grade kit, a nipper and a panel liner. Everything needed for a first build and nothing that is not.',
    priceIdr: 545000,
    items: [
      { sku: 'EG-RX782', quantity: 1 },
      { sku: 'TAM-74035', quantity: 1 },
      { sku: 'GM-PL-BLK', quantity: 1 },
    ],
  },
  {
    slug: 'master-grade-essentials',
    name: 'Master Grade essentials',
    description: 'The five things a Master Grade build actually consumes: nipper, knife, sanding sponge, setter and topcoat.',
    priceIdr: 685000,
    items: [
      { sku: 'TAM-74035', quantity: 1 },
      { sku: 'TAM-74040-STD', quantity: 1 },
      { sku: 'TAM-SS-600', quantity: 1 },
      { sku: 'MH-MS231', quantity: 1 },
      { sku: 'MH-MTC-FLAT', quantity: 1 },
    ],
  },
  {
    slug: 'waterslide-decal-set',
    name: 'Waterslide decal set',
    description: 'Setter, softer and reverse-action tweezers. What a Ver.Ka decal sheet needs and never includes.',
    priceIdr: 225000,
    items: [
      { sku: 'MH-MS231', quantity: 1 },
      { sku: 'MH-MS232', quantity: 1 },
      { sku: 'TAM-74093', quantity: 1 },
    ],
  },
];

export interface BannerSeed {
  title: string;
  subtitle: string;
  href: string;
  alt: string;
  position: number;
}

export const BANNERS: readonly BannerSeed[] = [
  {
    title: '20% off Master Grade',
    subtitle: 'Until the end of the month, with MASTERGRADE20.',
    href: '/kits/mg',
    alt: 'A Master Grade inner frame, part-built, on a workbench',
    position: 10,
  },
  {
    title: 'First kit?',
    subtitle: 'Three kits, one tool, no glue. About two hours each.',
    href: '/bundles/first-build-starter',
    alt: 'An Entry Grade runner with parts still attached',
    position: 20,
  },
  {
    title: 'Restocked: God Hand nippers',
    subtitle: 'The single-blade nipper that stops you sanding nubs.',
    href: '/tools/nippers',
    alt: 'A single-blade nipper resting on a cutting mat',
    position: 30,
  },
];
