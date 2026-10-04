-- AlterEnum DocumentType
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STORE_TRANSFER';

-- AlterEnum InventoryMovementType
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- CreateTable
CREATE TABLE IF NOT EXISTS "store_transfers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,6) NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "memo" TEXT,
    "status" "BankDocumentStatus" NOT NULL DEFAULT 'POSTED',
    "journalId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_transfers_orgId_number_key" ON "store_transfers"("orgId", "number");
CREATE INDEX IF NOT EXISTS "store_transfers_orgId_date_idx" ON "store_transfers"("orgId", "date" DESC);
CREATE INDEX IF NOT EXISTS "store_transfers_orgId_fromStoreId_idx" ON "store_transfers"("orgId", "fromStoreId");
CREATE INDEX IF NOT EXISTS "store_transfers_orgId_toStoreId_idx" ON "store_transfers"("orgId", "toStoreId");
CREATE INDEX IF NOT EXISTS "store_transfers_orgId_itemId_idx" ON "store_transfers"("orgId", "itemId");

DO $$ BEGIN
  ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
