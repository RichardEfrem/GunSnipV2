import type { CategoryNode } from './category.entity.js';
import type { ProductSummary } from './product-summary.entity.js';

/**
 * Everything the home page renders (FR-CAT-01), in one response.
 *
 * One endpoint rather than five, because the rails are drawn together and a page that fired
 * five requests would show its content in five instalments. They also share a cache lifetime:
 * the whole thing goes stale when the catalogue changes.
 *
 * The hero is not here — DESIGN.md §3.1 specifies one static image and no carousel, so it is
 * layout, not data. `banners` is the promo rail lower down, which the operator curates.
 */
export interface HomeContent {
  /** The grade shortcut row — real navigation, not decoration (DESIGN.md §3.1). */
  gradeShortcuts: readonly GradeShortcut[];
  newArrivals: readonly ProductSummary[];
  /** Evidence-weighted rating, not units sold — see `ProductRepository.findMostPopular`. */
  mostPopular: readonly ProductSummary[];
  tools: readonly ProductSummary[];
  /** Kits for the "First kit?" entry point: beginner-friendly, no glue, quick to build. */
  firstBuild: readonly ProductSummary[];
  banners: readonly PromoBanner[];
  /** The two navigation trees, so the page can link its rails without a second request. */
  categories: readonly CategoryNode[];
}

export interface GradeShortcut {
  code: string;
  name: string;
  productCount: number;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  alt: string;
  href: string;
}
