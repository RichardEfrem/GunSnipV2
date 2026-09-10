import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Prisma access for the home page's own data: the curated promo banners, and the per-grade
 * counts behind the shortcut row.
 *
 * Banners are their own aggregate — an operator curates them independently of the catalogue
 * (FR-PROMO-04) — which is why they are not on `ProductRepository`.
 */

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  alt: string;
  href: string;
}

@Injectable()
export class HomeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Active, in window, in curated order. A scheduled banner is invisible until it starts. */
  async activeBanners(now: Date, take: number): Promise<BannerRow[]> {
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      select: { id: true, title: true, subtitle: true, imageUrl: true, alt: true, href: true },
      orderBy: { position: 'asc' },
      take,
    });
  }

  /** Published kits per grade, for the shortcut row's counts. */
  async publishedCountByGrade(): Promise<Map<string, number>> {
    const groups = await this.prisma.product.groupBy({
      by: ['gradeId'],
      where: { status: 'PUBLISHED', type: 'MODEL_KIT' },
      _count: { _all: true },
    });

    const counts = new Map<string, number>();

    for (const group of groups) {
      if (group.gradeId !== null) counts.set(group.gradeId, group._count._all);
    }

    return counts;
  }
}
