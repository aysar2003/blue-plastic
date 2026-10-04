-- Stores, and the inventory account named for each one.
-- Existing inventory postings stay on Inventory Asset. A store account is a
-- sibling inventory account, so Inventory Asset remains postable.

ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

CREATE TABLE IF NOT EXISTS "stores" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inventoryAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stores_orgId_name_key" ON "stores"("orgId", "name");
CREATE INDEX IF NOT EXISTS "stores_orgId_isActive_idx" ON "stores"("orgId", "isActive");
CREATE INDEX IF NOT EXISTS "items_orgId_storeId_idx" ON "items"("orgId", "storeId");

DO $$ BEGIN
  ALTER TABLE "stores"
    ADD CONSTRAINT "stores_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "stores"
    ADD CONSTRAINT "stores_inventoryAccountId_fkey"
    FOREIGN KEY ("inventoryAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "items"
    ADD CONSTRAINT "items_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
