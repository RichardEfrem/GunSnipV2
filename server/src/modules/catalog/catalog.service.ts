import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { CategoryService } from './category.service.js';
import { DEFAULT_PAGE_SIZE, type ListProductsDto } from './dto/list-products.dto.js';
import { paginate, type Paginated } from './entities/paginated.entity.js';
import type { ProductDetail } from './entities/product-detail.entity.js';
import type { ProductSummary } from './entities/product-summary.entity.js';
import { toProductDetail, toProductSummary } from './product-mapper.js';
import { ProductRepository, type CatalogScope } from './product.repository.js';

/**
 * Browsing the catalogue (FR-CAT-03 … FR-CAT-09).
 *
 * Owns the rules a controller must not: what a page is, what a category means, and what
 * happens when a filter names something that does not exist.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryService,
  ) {}

  async list(query: ListProductsDto): Promise<Paginated<ProductSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const categoryIds = await this.resolveCategoryIds(query.category);

    const { rows, total } = await this.products.list({
      filter: query,
      scope: { categoryIds },
      sort: query.sort,
      skip: (page - 1) * limit,
      take: limit,
    });

    const now = Date.now();

    return paginate(
      rows.map((row) => toProductSummary(row, now)),
      page,
      limit,
      total,
    );
  }

/**
   * A page of search results: the catalogue's own rules, over a set someone else chose
   * (FR-SRCH-06).
   *
   * Search does not get its own listing logic. It hands over the candidate ids and reuses this
   * — the same filters, the same page size, the same card mapping — which is what makes the
   * results page and a category page identical below the heading, rather than two
   * implementations that drift the first time one of them is fixed.
   *
   * The one real difference is the default sort. A category listing with no `?sort=` means
   * "newest", because nothing has been asked and recency is the best neutral answer; a search
   * with no `?sort=` means "relevance", because something *has* been asked and the ranking is
   * the answer. That is why the two paths below are chosen by sort rather than by a flag.
   */
  async listMatching(
    query: ListProductsDto,
    rankedIds: readonly string[],
  ): Promise<Paginated<ProductSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const scope: CatalogScope = {
      categoryIds: await this.resolveCategoryIds(query.category),
      productIds: rankedIds,
    };

    const { rows, total } =
      query.sort === undefined || query.sort === 'relevance'
        ? await this.products.listRanked({ filter: query, scope, rankedIds, skip, take: limit })
        : await this.products.list({ filter: query, scope, sort: query.sort, skip, take: limit });

    const now = Date.now();

    return paginate(
      rows.map((row) => toProductSummary(row, now)),
      page,
      limit,
      total,
    );
  }

  async detail(slug: string): Promise<ProductDetail> {
    const row = await this.products.findBySlug(slug);

    if (row === null) {
      // Unpublished and non-existent are the same answer on purpose: a 403 on a draft would
      // confirm that a product exists at a slug the operator has not announced yet.
      throw new NotFoundError(`No product "${slug}".`, { slug });
    }

    return toProductDetail(row);
  }

  /**
   * A category filter names a slug; the query needs ids, and a parent has to mean its children
   * too. A slug that matches nothing raises rather than quietly returning the whole catalogue —
   * a typo in a shared URL should say so, not silently show something else.
   */
  async resolveCategoryIds(slug: string | undefined): Promise<string[] | undefined> {
    return slug === undefined ? undefined : this.categories.descendantIds(slug);
  }
}
