-- Phase 24: lot / serial tracking on items and inventory movements.
ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "trackLots" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trackSerials" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "inventory_transactions"
  ADD COLUMN IF NOT EXISTS "lotNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

ALTER TABLE "purchase_document_lines"
  ADD COLUMN IF NOT EXISTS "lotNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

ALTER TABLE "sales_document_lines"
  ADD COLUMN IF NOT EXISTS "lotNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

CREATE INDEX IF NOT EXISTS "inventory_transactions_orgId_itemId_lotNumber_idx"
  ON "inventory_transactions"("orgId", "itemId", "lotNumber");

CREATE INDEX IF NOT EXISTS "inventory_transactions_orgId_itemId_serialNumber_idx"
  ON "inventory_transactions"("orgId", "itemId", "serialNumber");

