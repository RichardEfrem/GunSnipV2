/**
 * Why stock moved (PRD §8.3, FR-ADM-05). Every row in inventory_movement carries one, so the
 * audit trail explains itself without a free-text note being mandatory.
 */
export const INVENTORY_MOVEMENT_REASONS = [
  'RESTOCK',
  'CORRECTION',
  'DAMAGE',
  'LOSS',
  'RETURN',
  'ORDER_FULFILLED',
] as const;

export type InventoryMovementReason = (typeof INVENTORY_MOVEMENT_REASONS)[number];
