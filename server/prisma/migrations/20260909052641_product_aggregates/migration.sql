-- AlterTable
ALTER TABLE "product" ADD COLUMN     "rating_average_tenths" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "units_sold" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_units_sold_idx" ON "product"("units_sold" DESC);

-- CreateIndex
CREATE INDEX "product_rating_average_tenths_idx" ON "product"("rating_average_tenths" DESC);
