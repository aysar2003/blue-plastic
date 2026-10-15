-- Stock counts belong to a store. Older adjustments stay unscoped (office).

ALTER TABLE "inventory_adjustments" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE INDEX IF NOT EXISTS "inventory_adjustments_orgId_storeId_idx"
  ON "inventory_adjustments"("orgId", "storeId");

ALTER TABLE "inventory_adjustments"
  DROP CONSTRAINT IF EXISTS "inventory_adjustments_storeId_fkey";

ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
