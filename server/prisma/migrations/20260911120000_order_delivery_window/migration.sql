-- The delivery window quoted at checkout, snapshotted onto the order (FR-CO-09, FR-ORD-05).
--
-- NOT NULL with no default: no order row exists before Phase 7 writes the first one, and every
-- order from then on is created with a window, so there is nothing to backfill.
ALTER TABLE "order" ADD COLUMN "shipping_max_days" INTEGER NOT NULL,
ADD COLUMN "shipping_min_days" INTEGER NOT NULL;
