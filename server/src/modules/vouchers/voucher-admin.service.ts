import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors/conflict.error.js';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { type CursorPage, toCursorPage } from '../../common/pagination/cursor-page.js';
import { decodeCursor, encodeCursor, keysetFilter } from '../../common/pagination/keyset-cursor.js';
import {
  DEFAULT_VOUCHER_PAGE_SIZE,
  type CreateVoucherDto,
  type ListVouchersDto,
  type UpdateVoucherDto,
} from './dto/write-voucher.dto.js';
import type { AdminVoucher } from './entities/admin-voucher.entity.js';
import { assertVoucherShape } from './voucher-shape.js';
import { VoucherWriteRepository } from './voucher-write.repository.js';

/**
 * Voucher CRUD (FR-ADM-10).
 *
 * Two rules live here rather than on the DTO, because neither can be seen from a single field:
 * the value fields have to match the type (`assertVoucherShape`), and a voucher that has already
 * been redeemed cannot be deleted — its redemption rows are part of an order's history, and
 * `onDelete: Restrict` in the schema would refuse anyway. Switching it off is what an operator
 * actually wants there, and saying so is more useful than a foreign-key error.
 */
@Injectable()
export class VoucherAdminService {
  constructor(private readonly vouchers: VoucherWriteRepository) {}

  async list(query: ListVouchersDto): Promise<CursorPage<AdminVoucher>> {
    const limit = query.limit ?? DEFAULT_VOUCHER_PAGE_SIZE;
    const term = query.q?.trim();

    const rows = await this.vouchers.list(
      {
        ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
        ...(term === undefined || term.length === 0
          ? {}
          : { code: { contains: term, mode: 'insensitive' as const } }),
        ...keysetFilter(decodeCursor(query.cursor), 'createdAt'),
      },
      limit + 1,
    );

    return toCursorPage(rows, limit, (row) => encodeCursor({ at: new Date(row.createdAt), id: row.id }));
  }

  async detail(id: string): Promise<AdminVoucher> {
    const voucher = await this.vouchers.findById(id);
    if (voucher === null) throw new NotFoundError('No voucher with that id.', { id });

    return voucher;
  }

  async create(dto: CreateVoucherDto): Promise<AdminVoucher> {
    const code = dto.code.trim().toUpperCase();

    if (await this.vouchers.isCodeTaken(code)) {
      throw new ConflictError(`A voucher with the code ${code} already exists.`, { code });
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    assertVoucherShape(dto.type, {
      percentOff: dto.percentOff ?? null,
      amountIdr: dto.amountIdr ?? null,
      maxDiscountIdr: dto.maxDiscountIdr ?? null,
      startsAt,
      endsAt,
    });

    return this.vouchers.create({
      code,
      type: dto.type,
      description: dto.description ?? null,
      percentOff: dto.percentOff ?? null,
      amountIdr: dto.amountIdr ?? null,
      minSpendIdr: dto.minSpendIdr ?? null,
      maxDiscountIdr: dto.maxDiscountIdr ?? null,
      startsAt,
      endsAt,
      usageLimit: dto.usageLimit ?? null,
      perSessionLimit: dto.perSessionLimit ?? null,
      isActive: dto.isActive ?? true,
      categoryIds: dto.categoryIds ?? [],
      productIds: dto.productIds ?? [],
    });
  }

  /**
   * A partial update is checked as a whole voucher, not field by field: clearing `percentOff` on
   * a PERCENTAGE voucher is only invalid in combination with its type, which the DTO cannot see.
   */
  async update(id: string, dto: UpdateVoucherDto): Promise<AdminVoucher> {
    const existing = await this.detail(id);

    const merged = {
      percentOff: dto.percentOff === undefined ? existing.percentOff : dto.percentOff,
      amountIdr: dto.amountIdr === undefined ? existing.amountIdr : dto.amountIdr,
      maxDiscountIdr: dto.maxDiscountIdr === undefined ? existing.maxDiscountIdr : dto.maxDiscountIdr,
      startsAt: dto.startsAt === undefined ? new Date(existing.startsAt) : new Date(dto.startsAt),
      endsAt: dto.endsAt === undefined ? new Date(existing.endsAt) : new Date(dto.endsAt),
    };

    assertVoucherShape(existing.type, merged);

    return this.vouchers.update(id, {
      ...(dto.description === undefined ? {} : { description: dto.description }),
      percentOff: merged.percentOff,
      amountIdr: merged.amountIdr,
      maxDiscountIdr: merged.maxDiscountIdr,
      ...(dto.minSpendIdr === undefined ? {} : { minSpendIdr: dto.minSpendIdr }),
      startsAt: merged.startsAt,
      endsAt: merged.endsAt,
      ...(dto.usageLimit === undefined ? {} : { usageLimit: dto.usageLimit }),
      ...(dto.perSessionLimit === undefined ? {} : { perSessionLimit: dto.perSessionLimit }),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      ...(dto.categoryIds === undefined ? {} : { categoryIds: dto.categoryIds }),
      ...(dto.productIds === undefined ? {} : { productIds: dto.productIds }),
    });
  }

  async remove(id: string): Promise<void> {
    const voucher = await this.detail(id);

    if (voucher.redemptionCount > 0) {
      throw new ConflictError(
        `That voucher has been redeemed ${voucher.redemptionCount} time${voucher.redemptionCount === 1 ? '' : 's'} ` +
          'and is part of those orders. Switch it off instead.',
        { id, redemptionCount: voucher.redemptionCount },
      );
    }

    await this.vouchers.remove(id);
  }
}
