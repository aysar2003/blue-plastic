-- Lite vertical close Pass 1: tip payout stamp, hotel nightly serviceDate,
-- lot disposal, claim export stamp, site store, weekday capacity, dock slot,
-- named price lists + % promotions.

ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'POS_TIP_PAYOUT';

ALTER TABLE "night_audit_runs"
  ADD COLUMN IF NOT EXISTS "tipPayoutJournalId" TEXT,
  ADD COLUMN IF NOT EXISTS "tipPayoutAt" TIMESTAMPTZ(6);

ALTER TABLE "folio_lines"
  ADD COLUMN IF NOT EXISTS "serviceDate" DATE;
CREATE INDEX IF NOT EXISTS "folio_lines_folioId_serviceDate_idx"
  ON "folio_lines"("folioId", "serviceDate");

ALTER TABLE "item_lots"
  ADD COLUMN IF NOT EXISTS "disposedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "disposedQuantity" DECIMAL(19,4);
CREATE INDEX IF NOT EXISTS "item_lots_orgId_disposedAt_idx"
  ON "item_lots"("orgId", "disposedAt");

ALTER TABLE "patient_visits"
  ADD COLUMN IF NOT EXISTS "claimsExportedAt" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "patient_visits_orgId_claimsExportedAt_idx"
  ON "patient_visits"("orgId", "claimsExportedAt");

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "storeId" TEXT;
CREATE INDEX IF NOT EXISTS "projects_storeId_idx" ON "projects"("storeId");
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "work_centers"
  ADD COLUMN IF NOT EXISTS "capacityByWeekday" JSONB;

ALTER TABLE "asn_shipments"
  ADD COLUMN IF NOT EXISTS "dockName" TEXT,
  ADD COLUMN IF NOT EXISTS "dockAt" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "asn_shipments_orgId_dockAt_idx"
  ON "asn_shipments"("orgId", "dockAt");

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "priceListId" TEXT;
CREATE INDEX IF NOT EXISTS "customers_priceListId_idx" ON "customers"("priceListId");

CREATE TABLE IF NOT EXISTS "price_lists" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "price_lists_orgId_name_key" ON "price_lists"("orgId", "name");
CREATE INDEX IF NOT EXISTS "price_lists_orgId_isActive_idx" ON "price_lists"("orgId", "isActive");
DO $$ BEGIN
  ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "price_list_items" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_items_priceListId_itemId_key"
  ON "price_list_items"("priceListId", "itemId");
CREATE INDEX IF NOT EXISTS "price_list_items_itemId_idx" ON "price_list_items"("itemId");
DO $$ BEGIN
  ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "item_promotions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemId" TEXT,
    "percentOff" DECIMAL(7,4) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "item_promotions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "item_promotions_orgId_isActive_startsOn_endsOn_idx"
  ON "item_promotions"("orgId", "isActive", "startsOn", "endsOn");
CREATE INDEX IF NOT EXISTS "item_promotions_itemId_idx" ON "item_promotions"("itemId");
DO $$ BEGIN
  ALTER TABLE "item_promotions" ADD CONSTRAINT "item_promotions_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "item_promotions" ADD CONSTRAINT "item_promotions_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
