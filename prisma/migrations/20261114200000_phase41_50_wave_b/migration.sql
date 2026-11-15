-- Phase 41–50 Wave B LITE

ALTER TABLE "tracking_categories" ADD COLUMN IF NOT EXISTS "restrictSpending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "budgetAmount" DECIMAL(19,4);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "retainerRemaining" DECIMAL(19,4);

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isFarm" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "item_lots" ADD COLUMN IF NOT EXISTS "originLabel" TEXT;

ALTER TABLE "patient_visits" ADD COLUMN IF NOT EXISTS "exportBatchId" TEXT;
CREATE INDEX IF NOT EXISTS "patient_visits_orgId_exportBatchId_idx" ON "patient_visits"("orgId", "exportBatchId");

CREATE TABLE IF NOT EXISTS "item_bin_defaults" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_bin_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_bin_defaults_orgId_storeId_itemId_key" ON "item_bin_defaults"("orgId", "storeId", "itemId");
CREATE INDEX IF NOT EXISTS "item_bin_defaults_orgId_binId_idx" ON "item_bin_defaults"("orgId", "binId");

ALTER TABLE "item_bin_defaults" DROP CONSTRAINT IF EXISTS "item_bin_defaults_orgId_fkey";
ALTER TABLE "item_bin_defaults" ADD CONSTRAINT "item_bin_defaults_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_bin_defaults" DROP CONSTRAINT IF EXISTS "item_bin_defaults_storeId_fkey";
ALTER TABLE "item_bin_defaults" ADD CONSTRAINT "item_bin_defaults_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_bin_defaults" DROP CONSTRAINT IF EXISTS "item_bin_defaults_itemId_fkey";
ALTER TABLE "item_bin_defaults" ADD CONSTRAINT "item_bin_defaults_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_bin_defaults" DROP CONSTRAINT IF EXISTS "item_bin_defaults_binId_fkey";
ALTER TABLE "item_bin_defaults" ADD CONSTRAINT "item_bin_defaults_binId_fkey" FOREIGN KEY ("binId") REFERENCES "stock_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;