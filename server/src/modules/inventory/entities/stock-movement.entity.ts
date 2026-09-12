import type { ActorKind, InventoryMovementReason } from '@gunsnip/shared';

/** One row of a variant's stock history (FR-ADM-05). */
export interface StockMovement {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  /** Signed: positive is stock arriving, negative is stock leaving. */
  delta: number;
  reason: InventoryMovementReason;
  note: string | null;
  actorKind: ActorKind;
  /** The order this movement was made for, when it came from fulfilment rather than by hand. */
  orderNumber: string | null;
  /** ISO 8601, UTC. Formatted at the render layer (CLAUDE.md Conventions). */
  createdAt: string;
}

/** A variant's levels after an adjustment, so the screen can redraw without a second request. */
export interface StockLevelView {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string | null;
  stockOnHand: number;
  stockReserved: number;
  /** Derived, never stored (PRD §8.3). */
  availableQuantity: number;
}
