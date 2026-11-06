-- Phase 31 WMS enterprise · Phase 32 metric snapshots · Phase 33 close helpers

DO $$ BEGIN
  CREATE TYPE "PutawayTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PickWaveStatus" AS ENUM ('OPEN', 'RELEASED', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "bin_movements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "runningQuantity" DECIMAL(19,4) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bin_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "putaway_tasks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "binId" TEXT,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(19,4) NOT NULL,
    "status" "PutawayTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "putaway_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pick_waves" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PickWaveStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pick_waves_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pick_tasks" ADD COLUMN IF NOT EXISTS "waveId" TEXT;

CREATE TABLE IF NOT EXISTS "metric_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bin_movements_orgId_binId_itemId_createdAt_idx" ON "bin_movements"("orgId", "binId", "itemId", "createdAt");
CREATE INDEX IF NOT EXISTS "bin_movements_orgId_sourceType_sourceId_idx" ON "bin_movements"("orgId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "putaway_tasks_orgId_status_createdAt_idx" ON "putaway_tasks"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "putaway_tasks_orgId_storeId_idx" ON "putaway_tasks"("orgId", "storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "pick_waves_orgId_number_key" ON "pick_waves"("orgId", "number");
CREATE INDEX IF NOT EXISTS "pick_waves_orgId_status_createdAt_idx" ON "pick_waves"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "pick_tasks_orgId_waveId_idx" ON "pick_tasks"("orgId", "waveId");
CREATE UNIQUE INDEX IF NOT EXISTS "metric_snapshots_orgId_date_metricKey_key" ON "metric_snapshots"("orgId", "date", "metricKey");
CREATE INDEX IF NOT EXISTS "metric_snapshots_orgId_metricKey_date_idx" ON "metric_snapshots"("orgId", "metricKey", "date");

DO $$ BEGIN
  ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_binId_fkey"
    FOREIGN KEY ("binId") REFERENCES "stock_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_binId_fkey"
    FOREIGN KEY ("binId") REFERENCES "stock_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pick_waves" ADD CONSTRAINT "pick_waves_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_waveId_fkey"
    FOREIGN KEY ("waveId") REFERENCES "pick_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
