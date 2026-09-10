import type { DecalType, Difficulty, StockState, ToolJob } from '@gunsnip/shared';
import type { CodedRef, LabelledRef, ProductImageRef, ProductSummary } from './product-summary.entity.js';

/**
 * A single product, with everything the detail page renders (DESIGN.md §3.5).
 *
 * Extends the card rather than repeating it, so a field can never mean one thing in a grid and
 * something else on the page it links to.
 *
 * The build-requirements block (FR-PDP-08) and the related rails are Phase 5 and live on their
 * own endpoints — they are a different query with a different cache lifetime, and bundling them
 * here would make every PDP pay for them.
 */
export interface ProductDetail extends ProductSummary {
  description: string | null;
  /** Breadcrumbs, root first (FR-CAT-03). */
  breadcrumbs: readonly LabelledRef[];
  images: readonly ProductImageRef[];
  variants: readonly ProductVariantSummary[];
  /** Kit specifications. Null on tools, which use `toolSpec` instead. */
  kitSpec: KitSpec | null;
  toolSpec: ToolSpec | null;
}

export interface ProductVariantSummary {
  id: string;
  sku: string;
  /** Only meaningful when the product has more than one variant. */
  name: string | null;
  /** `{ "colour": "Mr. Color 8 Silver" }` — what distinguishes this variant (PRD §5.2). */
  optionValues: Record<string, string>;
  priceIdr: number;
  compareAtPriceIdr: number | null;
  stockState: StockState;
  availableQuantity: number;
}

/** The specification block, in the order DESIGN.md §3.5 prints it. */
export interface KitSpec {
  grade: CodedRef | null;
  scale: CodedRef | null;
  series: LabelledRef | null;
  unitName: string | null;
  unitCode: string | null;
  runnerCount: number | null;
  partCount: number | null;
  difficulty: Difficulty | null;
  decalType: DecalType | null;
  articulationNotes: string | null;
  includes: readonly string[];
  releaseYear: number | null;
  /** Box estimate. Reviews carry what it actually took (FR-REV-04). */
  runtimeMinutesEst: number | null;
}

export interface ToolSpec {
  job: ToolJob | null;
  /** Grit number, paint code, blade angle — long-tail specs that differ per line (PRD §5.1). */
  attributes: Record<string, unknown>;
}
