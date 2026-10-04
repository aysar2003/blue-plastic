-- Tickets for stock taken from a store (manual entry or auto on transfer).

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'STORE_TICKET';

CREATE TABLE IF NOT EXISTS "store_tickets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "storeId" TEXT NOT NULL,
    "toStoreId" TEXT,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,6) NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "takenBy" TEXT,
    "memo" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'AUTO',
    "transferId" TEXT,
    "status" "BankDocumentStatus" NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_tickets_orgId_number_key" ON "store_tickets"("orgId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "store_tickets_transferId_key" ON "store_tickets"("transferId");
CREATE INDEX IF NOT EXISTS "store_tickets_orgId_date_idx" ON "store_tickets"("orgId", "date" DESC);
CREATE INDEX IF NOT EXISTS "store_tickets_orgId_storeId_idx" ON "store_tickets"("orgId", "storeId");
CREATE INDEX IF NOT EXISTS "store_tickets_orgId_itemId_idx" ON "store_tickets"("orgId", "itemId");

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_toStoreId_fkey"
    FOREIGN KEY ("toStoreId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store_tickets"
    ADD CONSTRAINT "store_tickets_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "store_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
