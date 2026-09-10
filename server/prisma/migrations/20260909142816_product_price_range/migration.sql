-- AlterTable
ALTER TABLE "product" ADD COLUMN     "max_price_idr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "min_price_idr" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_min_price_idr_idx" ON "product"("min_price_idr");

-- CreateIndex
CREATE INDEX "product_max_price_idr_idx" ON "product"("max_price_idr");
