-- Remaining QuickBooks item kinds + group/assembly components + payment deposit.
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'SUBTOTAL';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'GROUP';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'PAYMENT';

ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "printGroupItems" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "itemPaymentMethod" "PaymentMethod";
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "depositAccountId" TEXT;

DO $$ BEGIN
  ALTER TABLE "items"
    ADD CONSTRAINT "items_depositAccountId_fkey"
    FOREIGN KEY ("depositAccountId") REFERENCES "ledger_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "item_components" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentItemId" TEXT NOT NULL,
    "componentItemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "item_components_parentItemId_componentItemId_key"
  ON "item_components"("parentItemId", "componentItemId");

CREATE INDEX IF NOT EXISTS "item_components_orgId_parentItemId_idx"
  ON "item_components"("orgId", "parentItemId");

DO $$ BEGIN
  ALTER TABLE "item_components"
    ADD CONSTRAINT "item_components_parentItemId_fkey"
    FOREIGN KEY ("parentItemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "item_components"
    ADD CONSTRAINT "item_components_componentItemId_fkey"
    FOREIGN KEY ("componentItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
