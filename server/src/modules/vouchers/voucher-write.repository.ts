import { Injectable } from '@nestjs/common';
import type { VoucherType } from '@gunsnip/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AdminVoucher } from './entities/admin-voucher.entity.js';

/**
 * All Prisma access for voucher writes (FR-ADM-10).
 *
 * Separate from `VoucherRepository`, which reads a voucher's *terms* for the rules engine. That
 * one returns `VoucherTerms` — sets of ids, ready to be evaluated against a basket. This one
 * returns the row an operator edits. Same table, two different questions.
 */
const ADMIN_SELECT = {
  id: true,
  code: true,
  type: true,
  description: true,
  percentOff: true,
  amountIdr: true,
  minSpendIdr: true,
  maxDiscountIdr: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  perSessionLimit: true,
  usedCount: true,
  isActive: true,
  createdAt: true,
  categories: { select: { id: true } },
  products: { select: { id: true } },
  _count: { select: { redemptions: true } },
} satisfies Prisma.VoucherSelect;

type VoucherRow = Prisma.VoucherGetPayload<{ select: typeof ADMIN_SELECT }>;

export interface VoucherWrite {
  code: string;
  type: VoucherType;
  description: string | null;
  percentOff: number | null;
  amountIdr: number | null;
  minSpendIdr: number | null;
  maxDiscountIdr: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  perSessionLimit: number | null;
  isActive: boolean;
  categoryIds: readonly string[];
  productIds: readonly string[];
}

@Injectable()
export class VoucherWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(where: Prisma.VoucherWhereInput, take: number): Promise<AdminVoucher[]> {
    const rows = await this.prisma.voucher.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: ADMIN_SELECT,
    });

    return rows.map(toAdminVoucher);
  }

  async findById(id: string): Promise<AdminVoucher | null> {
    const row = await this.prisma.voucher.findUnique({ where: { id }, select: ADMIN_SELECT });
    return row === null ? null : toAdminVoucher(row);
  }

  async isCodeTaken(code: string): Promise<boolean> {
    return (await this.prisma.voucher.findUnique({ where: { code }, select: { id: true } })) !== null;
  }

  async create(write: VoucherWrite): Promise<AdminVoucher> {
    const { categoryIds, productIds, ...columns } = write;

    return toAdminVoucher(
      await this.prisma.voucher.create({
        data: {
          ...columns,
          categories: { connect: categoryIds.map((id) => ({ id })) },
          products: { connect: productIds.map((id) => ({ id })) },
        },
        select: ADMIN_SELECT,
      }),
    );
  }

  /**
   * `set` rather than `connect` for the scope relations: the operator sends the whole list, so
   * the stored scope has to *become* it. `connect` would only ever add, and a category could
   * never be taken out of a voucher's scope again.
   */
  async update(
    id: string,
    write: Partial<Omit<VoucherWrite, 'code' | 'type'>>,
  ): Promise<AdminVoucher> {
    const { categoryIds, productIds, ...columns } = write;

    return toAdminVoucher(
      await this.prisma.voucher.update({
        where: { id },
        data: {
          ...columns,
          ...(categoryIds === undefined ? {} : { categories: { set: categoryIds.map((cid) => ({ id: cid })) } }),
          ...(productIds === undefined ? {} : { products: { set: productIds.map((pid) => ({ id: pid })) } }),
        },
        select: ADMIN_SELECT,
      }),
    );
  }

  async remove(id: string): Promise<void> {
    await this.prisma.voucher.delete({ where: { id } });
  }
}

function toAdminVoucher(row: VoucherRow): AdminVoucher {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    description: row.description,
    percentOff: row.percentOff,
    amountIdr: row.amountIdr,
    minSpendIdr: row.minSpendIdr,
    maxDiscountIdr: row.maxDiscountIdr,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    usageLimit: row.usageLimit,
    perSessionLimit: row.perSessionLimit,
    usedCount: row.usedCount,
    redemptionCount: row._count.redemptions,
    isActive: row.isActive,
    categoryIds: row.categories.map((category) => category.id),
    productIds: row.products.map((product) => product.id),
    createdAt: row.createdAt.toISOString(),
  };
}
