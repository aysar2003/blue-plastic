-- Phase 36: AR invoice schedules + deferred revenue lite.

DO $$ BEGIN
  ALTER TYPE "RecurringDocType" ADD VALUE IF NOT EXISTS 'INVOICE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'UNEARNED_REVENUE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "recurring_templates"
  ADD COLUMN IF NOT EXISTS "deferRevenue" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "serviceMonths" INTEGER;

CREATE TABLE IF NOT EXISTS "deferred_revenue_schedules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recurringTemplateId" TEXT,
    "salesDocumentId" TEXT NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "recognizedAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "serviceMonths" INTEGER NOT NULL,
    "serviceStartOn" DATE NOT NULL,
    "nextRecognizeOn" DATE NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "deferralJournalId" TEXT,
    "lastRecognitionJournalId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "deferred_revenue_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "deferred_revenue_schedules_orgId_isComplete_nextRecognizeOn_idx"
  ON "deferred_revenue_schedules"("orgId", "isComplete", "nextRecognizeOn");
CREATE INDEX IF NOT EXISTS "deferred_revenue_schedules_salesDocumentId_idx"
  ON "deferred_revenue_schedules"("salesDocumentId");
CREATE INDEX IF NOT EXISTS "recurring_templates_orgId_type_isActive_nextRunOn_idx"
  ON "recurring_templates"("orgId", "type", "isActive", "nextRunOn");

DO $$ BEGIN
  ALTER TABLE "deferred_revenue_schedules"
    ADD CONSTRAINT "deferred_revenue_schedules_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "deferred_revenue_schedules"
    ADD CONSTRAINT "deferred_revenue_schedules_recurringTemplateId_fkey"
    FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
