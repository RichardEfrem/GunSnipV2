import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * All Prisma access for banners (FR-ADM-12, FR-PROMO-04).
 *
 * `listAll` is the operator's view — every banner, scheduled and expired alike, because the
 * point of a schedule is being able to see what is queued. `listLive` is the home page's, and
 * the difference between the two is the whole of FR-PROMO-04: a banner shows when it is active
 * *and* the clock is inside its window.
 */
export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  alt: string;
  href: string;
  position: number;
  /** ISO 8601, UTC. Null means "no bound" — on from creation, or on forever. */
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Whether it would render right now, so the list can say so without repeating the rule. */
  isLive: boolean;
}

export interface BannerWrite {
  title: string;
  subtitle: string | null;
  imageUrl: string;
  alt: string;
  href: string;
  position: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

const SELECT = {
  id: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  alt: true,
  href: true,
  position: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
} as const;

@Injectable()
export class BannerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(): Promise<AdminBanner[]> {
    const rows = await this.prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }], select: SELECT });
    const now = new Date();

    return rows.map((row) => toAdminBanner(row, now));
  }

  async findById(id: string): Promise<AdminBanner | null> {
    const row = await this.prisma.banner.findUnique({ where: { id }, select: SELECT });
    return row === null ? null : toAdminBanner(row, new Date());
  }

  async create(write: BannerWrite): Promise<AdminBanner> {
    return toAdminBanner(await this.prisma.banner.create({ data: write, select: SELECT }), new Date());
  }

  async update(id: string, write: Partial<BannerWrite>): Promise<AdminBanner> {
    return toAdminBanner(await this.prisma.banner.update({ where: { id }, data: write, select: SELECT }), new Date());
  }

  async reorder(ids: readonly string[]): Promise<AdminBanner[]> {
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.banner.update({ where: { id }, data: { position } })),
    );

    return this.listAll();
  }

  async remove(id: string): Promise<void> {
    await this.prisma.banner.delete({ where: { id } });
  }

  /** One past the last, so a new banner lands at the end rather than on top of an existing one. */
  async nextPosition(): Promise<number> {
    const last = await this.prisma.banner.findFirst({ orderBy: { position: 'desc' }, select: { position: true } });
    return (last?.position ?? -1) + 1;
  }
}

function toAdminBanner(row: BannerRow, now: Date): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    alt: row.alt,
    href: row.href,
    position: row.position,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive,
    isLive:
      row.isActive &&
      (row.startsAt === null || row.startsAt <= now) &&
      (row.endsAt === null || row.endsAt > now),
  };
}

interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  alt: string;
  href: string;
  position: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}
