import { Module } from '@nestjs/common';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';

/**
 * Stock as a bounded context of its own (FR-ADM-05, PRD §8.3).
 *
 * Until Phase 9 this folder held only pure functions, because reservation happens inside the
 * order transaction and had no service to hang off. Operator adjustment is the first stock
 * change that is nobody else's transaction, so it gets the module — and the reservation rules
 * stay where they are, imported by orders as functions rather than injected.
 */
@Module({
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}
