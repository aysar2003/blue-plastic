-- P8–P11: retention GL account key, retention release stamp, work centers.

ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'RETENTION_RECEIVABLE';

ALTER TABLE "sales_documents" ADD COLUMN IF NOT EXISTS "retentionReleasedAt" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "work_centers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" TEXT,
    "capacityMinutesPerWeek" DECIMAL(19,4) NOT NULL DEFAULT 2400,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_centers_orgId_name_key" ON "work_centers"("orgId", "name");
CREATE INDEX IF NOT EXISTS "work_centers_orgId_isActive_idx" ON "work_centers"("orgId", "isActive");

ALTER TABLE "routing_steps" ADD COLUMN IF NOT EXISTS "workCenterId" TEXT;
CREATE INDEX IF NOT EXISTS "routing_steps_workCenterId_idx" ON "routing_steps"("workCenterId");

DO $$ BEGIN
  ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_workCenterId_fkey"
    FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
