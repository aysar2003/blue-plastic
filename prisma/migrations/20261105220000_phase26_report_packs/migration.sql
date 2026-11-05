-- Phase 26: scheduled report packs.
CREATE TYPE "ReportPackCadence" AS ENUM ('MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE IF NOT EXISTS "report_packs" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "reportKeys" JSONB NOT NULL,
  "cadence" "ReportPackCadence" NOT NULL DEFAULT 'MANUAL',
  "emailTo" TEXT,
  "nextRunAt" TIMESTAMPTZ(6),
  "lastRunAt" TIMESTAMPTZ(6),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "report_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "report_pack_runs" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "ranAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fromDate" DATE NOT NULL,
  "toDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OK',
  "message" TEXT,
  "body" TEXT NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "report_pack_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "report_packs_orgId_isActive_nextRunAt_idx"
  ON "report_packs"("orgId", "isActive", "nextRunAt");

CREATE INDEX IF NOT EXISTS "report_pack_runs_orgId_packId_ranAt_idx"
  ON "report_pack_runs"("orgId", "packId", "ranAt" DESC);

ALTER TABLE "report_packs"
  ADD CONSTRAINT "report_packs_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_pack_runs"
  ADD CONSTRAINT "report_pack_runs_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_pack_runs"
  ADD CONSTRAINT "report_pack_runs_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "report_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
