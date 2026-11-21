-- Wave A deepen: service jobs FULL, contracts FULL, portal pay-proof,
-- POS till close payouts, replenish min/max, price-list date windows.

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentBankName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentAccountName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentAccountNumber" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paymentInstructions" TEXT;

ALTER TABLE "service_jobs" ADD COLUMN IF NOT EXISTS "siteLocation" TEXT;
ALTER TABLE "service_jobs" ADD COLUMN IF NOT EXISTS "promisedWindowStart" TIMESTAMPTZ(6);
ALTER TABLE "service_jobs" ADD COLUMN IF NOT EXISTS "promisedWindowEnd" TIMESTAMPTZ(6);

ALTER TABLE "sales_contracts" ADD COLUMN IF NOT EXISTS "changeOrderAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "sales_contracts" ADD COLUMN IF NOT EXISTS "retentionPercent" DECIMAL(7,4);

ALTER TABLE "pos_sessions" ADD COLUMN IF NOT EXISTS "closePayouts" DECIMAL(19,4);

ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "maxQty" DECIMAL(19,4);

ALTER TABLE "price_lists" ADD COLUMN IF NOT EXISTS "startsOn" DATE;
ALTER TABLE "price_lists" ADD COLUMN IF NOT EXISTS "endsOn" DATE;

CREATE TABLE IF NOT EXISTS "store_item_levels" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "minQty" DECIMAL(19,4),
    "maxQty" DECIMAL(19,4),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "store_item_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_item_levels_storeId_itemId_key" ON "store_item_levels"("storeId", "itemId");
CREATE INDEX IF NOT EXISTS "store_item_levels_orgId_storeId_idx" ON "store_item_levels"("orgId", "storeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_item_levels_orgId_fkey'
  ) THEN
    ALTER TABLE "store_item_levels"
      ADD CONSTRAINT "store_item_levels_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_item_levels_storeId_fkey'
  ) THEN
    ALTER TABLE "store_item_levels"
      ADD CONSTRAINT "store_item_levels_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_item_levels_itemId_fkey'
  ) THEN
    ALTER TABLE "store_item_levels"
      ADD CONSTRAINT "store_item_levels_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
