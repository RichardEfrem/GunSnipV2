import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/not-found.error.js';
import { type CursorPage, toCursorPage } from '../../common/pagination/cursor-page.js';
import { decodeCursor, encodeCursor, keysetFilter } from '../../common/pagination/keyset-cursor.js';
import { ADMIN_AUDIT } from '../orders/audit-actor.js';
import type { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { DEFAULT_MOVEMENT_PAGE_SIZE, type ListMovementsDto } from './dto/list-movements.dto.js';
import type { StockLevelView, StockMovement } from './entities/stock-movement.entity.js';
import { InventoryRepository } from './inventory.repository.js';
import { adjustStock } from './stock-adjustment.js';

/**
 * Operator stock control (FR-ADM-05).
 *
 * Every change goes through `adjust`, so there is exactly one way stock on hand moves by hand
 * and exactly one place the `inventory_movement` row is written. A screen that updated the level
 * directly would leave a number nobody can explain, which is the failure FR-ADM-05 exists to
 * prevent.
 *
 * The arithmetic is `adjustStock`, a pure function tested on its own; the locking is the
 * repository's; this service is what puts the two together and attributes the result.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly inventory: InventoryRepository) {}

  async adjust(variantId: string, dto: AdjustStockDto): Promise<StockLevelView> {
    const level = await this.inventory.adjust(variantId, (current) => ({
      variantId,
      stockOnHand: adjustStock(current, dto.delta).stockOnHand,
      delta: dto.delta,
      reason: dto.reason,
      note: dto.note,
      // Phase 1 gives the operator an identity and this gains an id; nothing else moves.
      by: ADMIN_AUDIT,
    }));

    if (level === null) throw new NotFoundError('No variant with that id.', { variantId });

    return level;
  }

  async movements(variantId: string, query: ListMovementsDto): Promise<CursorPage<StockMovement>> {
    if (!(await this.inventory.variantExists(variantId))) {
      throw new NotFoundError('No variant with that id.', { variantId });
    }

    const limit = query.limit ?? DEFAULT_MOVEMENT_PAGE_SIZE;
    const rows = await this.inventory.movements(
      variantId,
      keysetFilter(decodeCursor(query.cursor), 'createdAt'),
      limit + 1,
    );

    return toCursorPage(rows, limit, (row) => encodeCursor({ at: new Date(row.createdAt), id: row.id }));
  }
}
