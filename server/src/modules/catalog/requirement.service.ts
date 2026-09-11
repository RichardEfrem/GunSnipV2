import { Injectable } from '@nestjs/common';
import { NECESSITIES } from '@gunsnip/shared';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import type { BuildRequirement } from './entities/build-requirement.entity.js';
import { toProductSummary } from './product-mapper.js';
import { ProductRepository } from './product.repository.js';
import { RequirementRepository, type RequirementRow } from './requirement.repository.js';

/**
 * "What you'll need to build this" (FR-PDP-08) — the block DESIGN.md §3.5 calls the page's
 * reason to exist.
 *
 * The rule this service owns is which variant a tool would be added as. The client must never
 * choose: a tool with three variants has three prices, and letting the browser pick one is how
 * a customer ends up buying the wrong nipper because it happened to be first in the array.
 */
@Injectable()
export class RequirementService {
  constructor(
    private readonly requirements: RequirementRepository,
    private readonly products: ProductRepository,
  ) {}

  async forProduct(slug: string): Promise<BuildRequirement[]> {
    const kit = await this.products.findSiblingSubject(slug);

    // Same reasoning as the detail endpoint: a draft and a typo get the same answer, so a 404
    // never confirms that an unannounced slug exists.
    if (kit === null) throw new NotFoundError(`No product "${slug}".`, { slug });

    const rows = await this.requirements.findForKit(kit.id);
    const now = Date.now();

    return this.sortByNecessity(rows).map((row) => this.toRequirement(row, now));
  }

  /**
   * Required, then recommended, then optional — the order DESIGN.md §3.5 draws and the order
   * `NECESSITIES` declares, so the display order lives in the enum rather than in a comparator
   * that could disagree with it.
   *
   * Stable within a group, so the operator's curated `position` still decides which required
   * tool comes first.
   */
  private sortByNecessity(rows: readonly RequirementRow[]): RequirementRow[] {
    return [...rows].sort(
      (left, right) => NECESSITIES.indexOf(left.necessity) - NECESSITIES.indexOf(right.necessity),
    );
  }

  private toRequirement(row: RequirementRow, now: number): BuildRequirement {
    const tool = toProductSummary(row.tool, now);

    return {
      necessity: row.necessity,
      reason: row.reason,
      tool,
      variantId: this.defaultVariantId(row),
    };
  }

  /**
   * The cheapest variant that can actually be bought.
   *
   * Cheapest because the block is an upsell the customer did not ask for, and the honest
   * default for "you will also need a nipper" is the least the store can charge for one — not
   * whichever variant happens to sort first. Availability is re-derived here from the same
   * columns the card's stock pill uses, so a row can never offer a variant the pill calls out
   * of stock.
   */
  private defaultVariantId(row: RequirementRow): string | null {
    const buyable = row.tool.variants
      .filter((variant) => !variant.isArchived && variant.stockOnHand - variant.stockReserved > 0)
      .sort((left, right) => left.priceIdr - right.priceIdr);

    return buyable[0]?.id ?? null;
  }
}
