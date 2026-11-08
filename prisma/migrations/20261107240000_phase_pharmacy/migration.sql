-- Phase pharmacy: controlled items, lot expiry registry, Rx ref

ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "pharmacyControlled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "items_orgId_pharmacyControlled_idx" ON "items"("orgId", "pharmacyControlled");

CREATE TABLE IF NOT EXISTS "item_lots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_lots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_lots_orgId_itemId_lotNumber_key" ON "item_lots"("orgId", "itemId", "lotNumber");
CREATE INDEX IF NOT EXISTS "item_lots_orgId_expiryDate_idx" ON "item_lots"("orgId", "expiryDate");
CREATE INDEX IF NOT EXISTS "item_lots_itemId_expiryDate_idx" ON "item_lots"("itemId", "expiryDate");

DO $$ BEGIN
  ALTER TABLE "item_lots" ADD CONSTRAINT "item_lots_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "item_lots" ADD CONSTRAINT "item_lots_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "sales_document_lines" ADD COLUMN IF NOT EXISTS "lotExpiryDate" DATE;
ALTER TABLE "purchase_document_lines" ADD COLUMN IF NOT EXISTS "lotExpiryDate" DATE;
ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "prescriptionRef" TEXT;
