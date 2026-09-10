import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { CategoryRepository, type CategoryRow } from './category.repository.js';
import type { CategoryDetail, CategoryNode } from './entities/category.entity.js';

/**
 * The navigation taxonomy (FR-CAT-02).
 *
 * Two levels: Kits by grade, Tools by job. The tree is assembled here rather than in the
 * repository because "which rows are roots" and "a category means itself plus its descendants"
 * are rules about the taxonomy, not about how to read it from Postgres.
 */
@Injectable()
export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  /** The header dropdowns and the listing rail (FR-CAT-02). Roots first, children beneath. */
  async tree(): Promise<CategoryNode[]> {
    const [rows, counts] = await Promise.all([
      this.categories.findAll(),
      this.categories.countProductsByCategory(),
    ]);

    const childrenOf = new Map<string, CategoryRow[]>();

    for (const row of rows) {
      if (row.parentId === null) continue;

      const siblings = childrenOf.get(row.parentId) ?? [];
      siblings.push(row);
      childrenOf.set(row.parentId, siblings);
    }

    return rows
      .filter((row) => row.parentId === null)
      .map((root) => this.toNode(root, childrenOf, counts));
  }

  /** The listing page's heading and breadcrumbs (FR-CAT-03). */
  async detail(slug: string): Promise<CategoryDetail> {
    const category = await this.requireBySlug(slug);

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      type: category.type,
      breadcrumbs:
        category.parent === null
          ? [{ name: category.name, slug: category.slug }]
          : [
              { name: category.parent.name, slug: category.parent.slug },
              { name: category.name, slug: category.slug },
            ],
    };
  }

  /**
   * The category and everything under it, which is what "browse Kits" has to mean — every
   * product hangs off a leaf, so filtering on the root id alone would return nothing at all.
   */
  async descendantIds(slug: string): Promise<string[]> {
    const category = await this.requireBySlug(slug);
    const rows = await this.categories.findAll();

    return [category.id, ...rows.filter((row) => row.parentId === category.id).map((row) => row.id)];
  }

  private async requireBySlug(slug: string): Promise<CategoryRow> {
    const category = await this.categories.findBySlug(slug);

    if (category === null) {
      throw new NotFoundError(`No category "${slug}".`, { slug });
    }

    return category;
  }

  private toNode(
    row: CategoryRow,
    childrenOf: Map<string, CategoryRow[]>,
    counts: Map<string, number>,
  ): CategoryNode {
    const children = (childrenOf.get(row.id) ?? []).map((child) =>
      this.toNode(child, childrenOf, counts),
    );

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      // A root's own count is always zero, so it inherits its children's — otherwise every
      // top-level navigation entry would read "0 products".
      productCount:
        (counts.get(row.id) ?? 0) + children.reduce((total, child) => total + child.productCount, 0),
      children,
    };
  }
}
