import { Injectable } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import type { HomeContent, GradeShortcut } from './entities/home.entity.js';
import { toProductSummary } from './product-mapper.js';
import { HomeRepository } from './home.repository.js';
import { ProductRepository, type ProductSummaryRow } from './product.repository.js';
import { ReferenceRepository } from './reference.repository.js';

/**
 * The home page (FR-CAT-01).
 *
 * Every rail is a query with an intent, and the intents are written down here rather than left
 * implicit in a sort parameter — "most popular" is not "newest", and the difference is the
 * point of having the rail at all.
 */

/** Five across at the widest breakpoint, so a rail is one clean row (DESIGN.md §3.1). */
const RAIL_SIZE = 10;
const BANNER_LIMIT = 4;

/**
 * How many reviews a kit needs before the rail believes its rating.
 *
 * The weight the "Most popular" ranking gives the catalogue mean, in reviews. At ten, a kit
 * with ten reviews is scored half on its own average and half on the catalogue's, and one with
 * two hundred is scored almost entirely on its own. Low enough that a genuinely well-reviewed
 * kit reaches the rail in its first month, high enough that a single five-star review cannot.
 *
 * A merchandising decision, so it lives here rather than in the repository — the repository is
 * told what the floor is, and owns only how to rank by it.
 */
const RATING_EVIDENCE_FLOOR = 10;

@Injectable()
export class HomeService {
  constructor(
    private readonly products: ProductRepository,
    private readonly home: HomeRepository,
    private readonly reference: ReferenceRepository,
    private readonly categories: CategoryService,
  ) {}

  async content(): Promise<HomeContent> {
    const now = new Date();

    const [newArrivals, mostPopular, tools, firstBuild, banners, grades, gradeCounts, categories] =
      await Promise.all([
        this.products.findRail({ type: 'MODEL_KIT' }, 'newest', RAIL_SIZE),
        // Popularity here means "well reviewed by enough people to mean it", not "most units
        // shipped" — `units_sold` is already the `best_selling` sort, so a rail ordered by it
        // would be the listing page's first row with a different heading. The evidence
        // weighting is what makes this rail say something the sorts do not.
        this.products.findMostPopular(RATING_EVIDENCE_FLOOR, RAIL_SIZE),
        this.products.findRail({ type: 'TOOL_SUPPLY' }, 'best_selling', RAIL_SIZE),
        // "Three kits, one tool, no glue" (DESIGN.md §3.1) — beginner difficulty is the honest
        // filter for that, and in-stock because recommending a first kit nobody can buy is
        // worse than recommending none.
        this.products.findRail(
          { type: 'MODEL_KIT', difficulty: ['BEGINNER'], inStock: true },
          'best_selling',
          RAIL_SIZE,
        ),
        this.home.activeBanners(now, BANNER_LIMIT),
        this.reference.grades(),
        this.home.publishedCountByGrade(),
        this.categories.tree(),
      ]);

    // One timestamp for the whole page, so two rails cannot disagree about whether a product
    // published thirty days ago still counts as new.
    const timestamp = now.getTime();
    const summarise = (rows: readonly ProductSummaryRow[]) =>
      rows.map((row) => toProductSummary(row, timestamp));

    return {
      gradeShortcuts: this.toShortcuts(grades, gradeCounts),
      newArrivals: summarise(newArrivals),
      mostPopular: summarise(mostPopular),
      tools: summarise(tools),
      firstBuild: summarise(firstBuild),
      banners,
      categories,
    };
  }

  /**
   * Grades that actually have kits. Unlike the filter rail, an empty shortcut is not useful
   * information — it is a button that leads to an empty page, so it is left out rather than
   * disabled.
   */
  private toShortcuts(
    grades: readonly { id: string; value: string; label: string }[],
    counts: Map<string, number>,
  ): GradeShortcut[] {
    return grades
      .map((grade) => ({
        code: grade.value,
        name: grade.label,
        productCount: counts.get(grade.id) ?? 0,
      }))
      .filter((shortcut) => shortcut.productCount > 0);
  }
}
