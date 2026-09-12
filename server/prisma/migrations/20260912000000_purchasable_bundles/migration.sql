-- Bundles become purchasable as a single line item (FR-CAT-11).
--
-- A bundle is **one line to the customer and one row per component underneath**. Stock is held,
-- consumed and released per variant — there is no such thing as "one bundle" on a shelf — so a
-- cart line that had no variant would have to be special-cased by every rule that touches money
-- or inventory. Tagging the component rows with the bundle they came from instead leaves
-- revalidation, reservation, voucher scope and order placement working on variants, unchanged,
-- and makes the bundle a grouping the *view* performs.

-- ---------------------------------------------------------------------------------------------
-- cart_item: which bundle a line was added as part of.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "cart_item" ADD COLUMN "bundle_id" UUID;

ALTER TABLE "cart_item"
  ADD CONSTRAINT "cart_item_bundle_id_fkey"
  FOREIGN KEY ("bundle_id") REFERENCES "bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The old unique was `(cart_id, variant_id)`, which assumed a variant appears in a cart at most
-- once. It can now appear twice for a good reason: a nipper bought on its own and the same nipper
-- inside a starter bundle are two different things to the customer, priced differently, and
-- removing the bundle must not take their loose nipper with it.
DROP INDEX "cart_item_cart_id_variant_id_key";

-- So the rule splits in two. Both are partial indexes, which Prisma cannot express — a single
-- `UNIQUE (cart_id, variant_id, bundle_id)` would not do the job, because Postgres compares NULLs
-- as distinct and every standalone line has a NULL bundle: the same variant could then be added
-- as two separate rows and the "adding it again raises the quantity" rule would quietly stop
-- holding.
CREATE UNIQUE INDEX "cart_item_standalone_variant_key"
  ON "cart_item"("cart_id", "variant_id") WHERE "bundle_id" IS NULL;

CREATE UNIQUE INDEX "cart_item_bundled_variant_key"
  ON "cart_item"("cart_id", "bundle_id", "variant_id") WHERE "bundle_id" IS NOT NULL;

-- Reading and removing a bundle's lines as a group is the cart's hot path once one is added.
CREATE INDEX "cart_item_cart_id_bundle_id_idx" ON "cart_item"("cart_id", "bundle_id");
CREATE INDEX "cart_item_bundle_id_idx" ON "cart_item"("bundle_id");

-- ---------------------------------------------------------------------------------------------
-- order_item: which bundle a component line was bought as part of.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "order_item" ADD COLUMN "bundle_id" UUID,
ADD COLUMN "bundle_name_snapshot" TEXT;

-- SET NULL, like `variant_id`: retiring a bundle must not be blocked by, or rewrite, the orders
-- that bought it (FR-ORD-05).
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_bundle_id_fkey"
  FOREIGN KEY ("bundle_id") REFERENCES "bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An id implies a name, but a name outlives its id — that is what a snapshot is for. The order
-- screen groups components by the *name*, so the SET NULL above cannot scatter a bundle's
-- components into loose lines the day somebody retires it.
ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_bundle_id_implies_name"
  CHECK ("bundle_id" IS NULL OR "bundle_name_snapshot" IS NOT NULL);

CREATE INDEX "order_item_bundle_id_idx" ON "order_item"("bundle_id");
