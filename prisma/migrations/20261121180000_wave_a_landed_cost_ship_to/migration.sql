-- Wave A: landed cost allocations + extra customer ship-to addresses.

ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'LANDED_COST';

CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "line1" TEXT,
  "line2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "country" CHAR(2),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_addresses_orgId_customerId_idx"
  ON "customer_addresses"("orgId", "customerId");

CREATE TABLE IF NOT EXISTS "landed_cost_batches" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "memo" TEXT,
  "postedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "journalId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "landed_cost_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landed_cost_batches_orgId_billId_idx"
  ON "landed_cost_batches"("orgId", "billId");

CREATE INDEX IF NOT EXISTS "landed_cost_batches_orgId_postedAt_idx"
  ON "landed_cost_batches"("orgId", "postedAt" DESC);

CREATE TABLE IF NOT EXISTS "landed_cost_lines" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "storeId" TEXT,
  "amount" DECIMAL(19,4) NOT NULL,
  "quantity" DECIMAL(19,4),
  CONSTRAINT "landed_cost_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landed_cost_lines_orgId_itemId_idx"
  ON "landed_cost_lines"("orgId", "itemId");

CREATE INDEX IF NOT EXISTS "landed_cost_lines_batchId_idx"
  ON "landed_cost_lines"("batchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_addresses_orgId_fkey'
  ) THEN
    ALTER TABLE "customer_addresses"
      ADD CONSTRAINT "customer_addresses_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_addresses_customerId_fkey'
  ) THEN
    ALTER TABLE "customer_addresses"
      ADD CONSTRAINT "customer_addresses_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_batches_orgId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_batches"
      ADD CONSTRAINT "landed_cost_batches_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_batches_billId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_batches"
      ADD CONSTRAINT "landed_cost_batches_billId_fkey"
      FOREIGN KEY ("billId") REFERENCES "purchase_documents"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_batches_journalId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_batches"
      ADD CONSTRAINT "landed_cost_batches_journalId_fkey"
      FOREIGN KEY ("journalId") REFERENCES "journals"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_lines_batchId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_lines"
      ADD CONSTRAINT "landed_cost_lines_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "landed_cost_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_lines_itemId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_lines"
      ADD CONSTRAINT "landed_cost_lines_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "items"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landed_cost_lines_storeId_fkey'
  ) THEN
    ALTER TABLE "landed_cost_lines"
      ADD CONSTRAINT "landed_cost_lines_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
