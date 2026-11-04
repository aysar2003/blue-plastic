-- Phase 11.14: wholesale customers and an optional wholesale price on the item.
CREATE TYPE "CustomerPriceLevel" AS ENUM ('RETAIL', 'WHOLESALE');

ALTER TABLE "customers"
  ADD COLUMN "priceLevel" "CustomerPriceLevel" NOT NULL DEFAULT 'RETAIL';

ALTER TABLE "items"
  ADD COLUMN "wholesalePrice" DECIMAL(19, 4);
