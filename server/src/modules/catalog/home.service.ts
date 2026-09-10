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
 * implicit in a sort parameter — "back in stock" is not "newest", and the difference is the
 * point of having the rail at all.
 */

/** Five across at the widest breakpoint, so a rail is one clean row (DESIGN.md §3.1). */
const RAIL_SIZE = 10;
const BANNER_LIMIT = 4;

/** A restock older than this is not news. Matches what the seed back-dates. */
const RESTOCK_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const restockedSince = new Date(now.getTime() - RESTOCK_WINDOW_DAYS * DAY_MS);

    const [newArrivals, backInStock, tools, firstBuild, banners, grades, gradeCounts, categories] =
      await Promise.all([
        this.products.findRail({ type: 'MODEL_KIT' }, 'newest', RAIL_SIZE),
        this.products.findRecentlyRestocked(restockedSince, RAIL_SIZE),
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
      backInStock: summarise(backInStock),
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
