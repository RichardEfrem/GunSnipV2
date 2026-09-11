import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { SUMMARY_SELECT, type ProductSummaryRow } from './product.repository.js';

/**
 * Prisma access for `product_requirement` — the tools a kit needs (PRD §5.3, FR-PDP-08).
 *
 * Its own repository rather than a method on `ProductRepository`: the row is a relationship
 * between two products with its own columns (necessity, reason, position), and the admin
 * editor in Phase 9 writes it without touching either product.
 */

const REQUIREMENT_SELECT = {
  necessity: true,
  reason: true,
  position: true,
  tool: { select: SUMMARY_SELECT },
} satisfies Prisma.ProductRequirementSelect;

export type RequirementRow = Omit<
  Prisma.ProductRequirementGetPayload<{ select: typeof REQUIREMENT_SELECT }>,
  'tool'
> & { tool: ProductSummaryRow };

@Injectable()
export class RequirementRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A kit's tools, in display order.
   *
   * Ordered by `position` alone, not by necessity first: the seed already numbers a kit's
   * requirements so that required tools come before recommended ones, and an operator
   * reordering them in Phase 9 is expressing an opinion the display should honour. The service
   * groups by necessity for the headings; this preserves the curated order inside each group.
   *
   * Unpublished tools are excluded — a checkbox for something the store will not sell is a
   * dead end, and the block is a shopping list rather than a bill of materials.
   */
  async findForKit(kitProductId: string): Promise<RequirementRow[]> {
    return this.prisma.productRequirement.findMany({
      where: { kitProductId, tool: { status: 'PUBLISHED' } },
      select: REQUIREMENT_SELECT,
      orderBy: { position: 'asc' },
    });
  }
}
