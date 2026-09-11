import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import type { RelatedProducts } from './entities/related-products.entity.js';
import { toProductSummary } from './product-mapper.js';
import { ProductRepository } from './product.repository.js';

/**
 * The rails below the product page (FR-PDP-10).
 *
 * One rail is a strict subset of the other's candidates — every same-unit kit is also
 * same-series — so the two queries cannot be run blind in parallel without the same card
 * appearing twice. Ordering them is the whole of this service's logic.
 */

/** Five across at the widest breakpoint, matching the home rails (DESIGN.md §3.1). */
const RAIL_SIZE = 10;

@Injectable()
export class RelatedService {
  constructor(private readonly products: ProductRepository) {}

  async forProduct(slug: string): Promise<RelatedProducts> {
    const subject = await this.products.findSiblingSubject(slug);

    if (subject === null) throw new NotFoundError(`No product "${slug}".`, { slug });

    const sameUnit = await this.products.findSameUnit(subject, RAIL_SIZE);
    const sameSeries = await this.products.findSameSeries(
      subject,
      sameUnit.map((row) => row.id),
      RAIL_SIZE,
    );

    // One timestamp across both rails, so a product thirty days old cannot read as new in one
    // and not the other.
    const now = Date.now();

    return {
      sameUnit: sameUnit.map((row) => toProductSummary(row, now)),
      sameSeries: sameSeries.map((row) => toProductSummary(row, now)),
    };
  }
}
