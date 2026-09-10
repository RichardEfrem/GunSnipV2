import { Injectable } from '@nestjs/common';
import { DIFFICULTIES, TOOL_JOBS } from '@gunsnip/shared';
import { CatalogService } from './catalog.service.js';
import type { ProductFilterDto } from './dto/product-filter.dto.js';
import type { FacetOption, Facets } from './entities/facets.entity.js';
import { ProductRepository, type CatalogScope } from './product.repository.js';
import { ReferenceRepository, type ReferenceOption } from './reference.repository.js';

/**
 * The filter rail's options and counts (FR-CAT-04, FR-CAT-10).
 *
 * Two rules shape the whole file:
 *
 *  1. **Every option is returned, including zero-count ones.** The client renders those
 *     disabled rather than hiding them — options that vanish as you tick make the filter set
 *     feel unstable (DESIGN.md §3.2). So the option list comes from the reference tables and
 *     the counts are joined onto it, not the other way round.
 *
 *  2. **A group's count excludes that group's own selections.** With MG ticked, the number
 *     beside RG has to mean "MG or RG", not "MG and RG at once" — which is always zero and
 *     would disable every remaining option in the group.
 *
 * That second rule is why this is several queries rather than one: each group needs a different
 * predicate. They are independent, so they go out together.
 */
@Injectable()
export class FacetService {
  constructor(
    private readonly products: ProductRepository,
    private readonly reference: ReferenceRepository,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * @param productIds Present only on a search — the products the query matched, so the rail's
   * counts describe the search results rather than the whole catalogue (FR-SRCH-06). Absent on
   * a category page, where nothing has narrowed the set but the category itself.
   */
  async facets(filter: ProductFilterDto, productIds?: readonly string[]): Promise<Facets> {
    const scope: CatalogScope = {
      categoryIds: await this.catalog.resolveCategoryIds(filter.category),
      productIds,
    };

    const [
      total,
      inStockCount,
      price,
      grades,
      scales,
      series,
      brands,
      gradeCounts,
      scaleCounts,
      seriesCounts,
      brandCounts,
      difficultyCounts,
      toolJobCounts,
    ] = await Promise.all([
      this.products.count(filter, scope),
      this.products.countInStock(filter, scope),
      this.products.priceBounds(filter, scope),
      this.reference.grades(),
      this.reference.scales(),
      this.reference.series(),
      this.reference.brands(),
      this.products.facetCounts(filter, 'gradeId', 'grade', scope),
      this.products.facetCounts(filter, 'scaleId', 'scale', scope),
      this.products.facetCounts(filter, 'seriesId', 'series', scope),
      this.products.facetCounts(filter, 'brandId', 'brand', scope),
      this.products.facetCounts(filter, 'difficulty', 'difficulty', scope),
      this.products.facetCounts(filter, 'toolJob', 'toolJob', scope),
    ]);

    return {
      total,
      inStockCount,
      price,
      grades: this.fromReference(grades, gradeCounts, filter.grade),
      scales: this.fromReference(scales, scaleCounts, filter.scale),
      series: this.fromReference(series, seriesCounts, filter.series),
      brands: this.fromReference(brands, brandCounts, filter.brand),
      difficulties: this.fromEnum(DIFFICULTIES, difficultyCounts, filter.difficulty),
      toolJobs: this.fromEnum(TOOL_JOBS, toolJobCounts, filter.toolJob),
    };
  }

  /**
   * Reference-table options. Counts are keyed by id because that is what `groupBy` returns,
   * while the option's public value is its code or slug — a URL never carries a UUID
   * (FR-CAT-07).
   */
  private fromReference(
    options: readonly ReferenceOption[],
    counts: Map<string, number>,
    selected: readonly string[] | undefined,
  ): FacetOption[] {
    return options.map((option) => ({
      value: option.value,
      label: option.label,
      count: counts.get(option.id) ?? 0,
      isSelected: selected?.includes(option.value) ?? false,
    }));
  }

  /**
   * Postgres enum options. The list is the shared union rather than the distinct values present
   * in the data — an empty catalogue should still show the full set of difficulties, greyed
   * out, instead of an empty group that looks broken.
   */
  private fromEnum(
    values: readonly string[],
    counts: Map<string, number>,
    selected: readonly string[] | undefined,
  ): FacetOption[] {
    return values.map((value) => ({
      value,
      label: toLabel(value),
      count: counts.get(value) ?? 0,
      isSelected: selected?.includes(value) ?? false,
    }));
  }
}

/** `DECAL_AIDS` → `Decal aids`. Sentence case, because only acronyms are capitalised (DESIGN.md §2.2). */
function toLabel(value: string): string {
  const words = value.toLowerCase().split('_');
  return words.map((word, index) => (index === 0 ? capitalise(word) : word)).join(' ');
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
