-- The code a barcode scanner sends at the till. Null for items that are sold by SKU only.
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "items_orgId_barcode_key" ON "items"("orgId", "barcode");
