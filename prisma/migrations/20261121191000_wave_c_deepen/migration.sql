-- Wave C deepen: HRIS hire/hours, collab attach, FX payment rates,
-- loans disbursement/aging, insurance claims, subscriptions dunning.

ALTER TABLE "sign_requests" ADD COLUMN IF NOT EXISTS "salesDocumentId" TEXT;
ALTER TABLE "sign_requests" ADD COLUMN IF NOT EXISTS "purchaseDocumentId" TEXT;

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "serviceJobId" TEXT;

ALTER TABLE "planning_assignments" ADD COLUMN IF NOT EXISTS "projectTimeEntryId" TEXT;

ALTER TABLE "loan_accounts" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
ALTER TABLE "loan_accounts" ADD COLUMN IF NOT EXISTS "disbursementJournalId" TEXT;
ALTER TABLE "loan_accounts" ADD COLUMN IF NOT EXISTS "disbursedAt" TIMESTAMPTZ(6);

ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "coverStart" DATE;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "coverEnd" DATE;
UPDATE "insurance_policies" SET "coverStart" = "startDate" WHERE "coverStart" IS NULL;
UPDATE "insurance_policies" SET "coverEnd" = "endDate" WHERE "coverEnd" IS NULL;
ALTER TABLE "insurance_policies" ALTER COLUMN "coverStart" SET NOT NULL;
ALTER TABLE "insurance_policies" ALTER COLUMN "coverEnd" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "sign_requests_orgId_salesDocumentId_idx" ON "sign_requests"("orgId", "salesDocumentId");
CREATE INDEX IF NOT EXISTS "sign_requests_orgId_purchaseDocumentId_idx" ON "sign_requests"("orgId", "purchaseDocumentId");
CREATE INDEX IF NOT EXISTS "appointments_orgId_projectId_idx" ON "appointments"("orgId", "projectId");
CREATE INDEX IF NOT EXISTS "appointments_orgId_serviceJobId_idx" ON "appointments"("orgId", "serviceJobId");
CREATE INDEX IF NOT EXISTS "insurance_policies_orgId_coverStart_coverEnd_idx" ON "insurance_policies"("orgId", "coverStart", "coverEnd");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sign_requests_salesDocumentId_fkey'
  ) THEN
    ALTER TABLE "sign_requests"
      ADD CONSTRAINT "sign_requests_salesDocumentId_fkey"
      FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sign_requests_purchaseDocumentId_fkey'
  ) THEN
    ALTER TABLE "sign_requests"
      ADD CONSTRAINT "sign_requests_purchaseDocumentId_fkey"
      FOREIGN KEY ("purchaseDocumentId") REFERENCES "purchase_documents"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_projectId_fkey'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_serviceJobId_fkey'
  ) THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_serviceJobId_fkey"
      FOREIGN KEY ("serviceJobId") REFERENCES "service_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planning_assignments_projectTimeEntryId_fkey'
  ) THEN
    ALTER TABLE "planning_assignments"
      ADD CONSTRAINT "planning_assignments_projectTimeEntryId_fkey"
      FOREIGN KEY ("projectTimeEntryId") REFERENCES "project_time_entries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loan_accounts_bankAccountId_fkey'
  ) THEN
    ALTER TABLE "loan_accounts"
      ADD CONSTRAINT "loan_accounts_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "ledger_accounts"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE "InsuranceClaimStatus" AS ENUM ('OPEN', 'SUBMITTED', 'PAID', 'DENIED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "insurance_claims" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'OPEN',
    "payer" TEXT,
    "notes" TEXT,
    "claimedOn" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "insurance_claims_orgId_status_claimedOn_idx" ON "insurance_claims"("orgId", "status", "claimedOn");
CREATE INDEX IF NOT EXISTS "insurance_claims_policyId_idx" ON "insurance_claims"("policyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_orgId_fkey'
  ) THEN
    ALTER TABLE "insurance_claims"
      ADD CONSTRAINT "insurance_claims_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_policyId_fkey'
  ) THEN
    ALTER TABLE "insurance_claims"
      ADD CONSTRAINT "insurance_claims_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "fx_daily_rates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "rateDate" DATE NOT NULL,
    "rate" DECIMAL(19,9) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "fx_daily_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fx_daily_rates_orgId_currencyCode_rateDate_key" ON "fx_daily_rates"("orgId", "currencyCode", "rateDate");
CREATE INDEX IF NOT EXISTS "fx_daily_rates_orgId_currencyCode_rateDate_idx" ON "fx_daily_rates"("orgId", "currencyCode", "rateDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fx_daily_rates_orgId_fkey'
  ) THEN
    ALTER TABLE "fx_daily_rates"
      ADD CONSTRAINT "fx_daily_rates_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
