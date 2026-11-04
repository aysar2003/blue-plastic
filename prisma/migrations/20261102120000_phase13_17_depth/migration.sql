-- Phase 13–16 schema: fixed assets, equity register, HRIS lite, collab apps.

CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');
CREATE TYPE "EquityEventKind" AS ENUM ('CONTRIBUTION', 'DRAW', 'DIVIDEND');
CREATE TYPE "JobOpeningStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');
CREATE TYPE "ApplicantStatus" AS ENUM ('NEW', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED');
CREATE TYPE "SignRequestStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "fixed_asset_categories" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "usefulLifeMonths" SMALLINT NOT NULL,
  "assetAccountId" TEXT NOT NULL,
  "accumDepAccountId" TEXT NOT NULL,
  "expenseAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "fixed_asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fixed_assets" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "acquiredOn" DATE NOT NULL,
  "cost" DECIMAL(19,4) NOT NULL,
  "salvageValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "usefulLifeMonths" SMALLINT NOT NULL,
  "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "accumulatedDepreciation" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lastDepreciatedThrough" DATE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fixed_asset_depreciations" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "journalId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_depreciations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shareholders" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shares" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "ownershipPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
  "capitalAccountId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "shareholders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "equity_events" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "shareholderId" TEXT,
  "kind" "EquityEventKind" NOT NULL,
  "date" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "memo" TEXT,
  "bankAccountId" TEXT NOT NULL,
  "equityAccountId" TEXT NOT NULL,
  "journalId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equity_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_openings" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "description" TEXT,
  "status" "JobOpeningStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "applicants" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "jobOpeningId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "status" "ApplicantStatus" NOT NULL DEFAULT 'NEW',
  "employeeId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appraisals" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "score" DECIMAL(5,2),
  "notes" TEXT,
  "reviewedAt" DATE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "appraisals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "discuss_channels" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "discuss_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "discuss_messages" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discuss_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_types" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "durationMins" SMALLINT NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "customerId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sign_requests" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "SignRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "storageKey" TEXT,
  "originalName" TEXT,
  "signerName" TEXT,
  "signerEmail" TEXT,
  "signatureData" TEXT,
  "signedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sign_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "surveys" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "questions" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "respondent" TEXT,
  "answers" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_categories_orgId_name_key" ON "fixed_asset_categories"("orgId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_orgId_number_key" ON "fixed_assets"("orgId", "number");
CREATE INDEX IF NOT EXISTS "fixed_assets_orgId_status_idx" ON "fixed_assets"("orgId", "status");
CREATE INDEX IF NOT EXISTS "fixed_asset_depreciations_orgId_assetId_periodEnd_idx" ON "fixed_asset_depreciations"("orgId", "assetId", "periodEnd");
CREATE INDEX IF NOT EXISTS "shareholders_orgId_name_idx" ON "shareholders"("orgId", "name");
CREATE INDEX IF NOT EXISTS "equity_events_orgId_date_idx" ON "equity_events"("orgId", "date" DESC);
CREATE INDEX IF NOT EXISTS "job_openings_orgId_status_idx" ON "job_openings"("orgId", "status");
CREATE INDEX IF NOT EXISTS "applicants_orgId_jobOpeningId_status_idx" ON "applicants"("orgId", "jobOpeningId", "status");
CREATE INDEX IF NOT EXISTS "appraisals_orgId_employeeId_idx" ON "appraisals"("orgId", "employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "discuss_channels_orgId_name_key" ON "discuss_channels"("orgId", "name");
CREATE INDEX IF NOT EXISTS "discuss_messages_orgId_channelId_createdAt_idx" ON "discuss_messages"("orgId", "channelId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_types_orgId_name_key" ON "appointment_types"("orgId", "name");
CREATE INDEX IF NOT EXISTS "appointments_orgId_startsAt_idx" ON "appointments"("orgId", "startsAt");
CREATE INDEX IF NOT EXISTS "sign_requests_orgId_status_idx" ON "sign_requests"("orgId", "status");
CREATE INDEX IF NOT EXISTS "surveys_orgId_updatedAt_idx" ON "surveys"("orgId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "survey_responses_orgId_surveyId_idx" ON "survey_responses"("orgId", "surveyId");

DO $$ BEGIN
  ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_accumDepAccountId_fkey" FOREIGN KEY ("accumDepAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "fixed_asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fixed_asset_depreciations" ADD CONSTRAINT "fixed_asset_depreciations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "fixed_asset_depreciations" ADD CONSTRAINT "fixed_asset_depreciations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "shareholders" ADD CONSTRAINT "shareholders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "shareholders" ADD CONSTRAINT "shareholders_capitalAccountId_fkey" FOREIGN KEY ("capitalAccountId") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "equity_events" ADD CONSTRAINT "equity_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equity_events" ADD CONSTRAINT "equity_events_shareholderId_fkey" FOREIGN KEY ("shareholderId") REFERENCES "shareholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equity_events" ADD CONSTRAINT "equity_events_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "equity_events" ADD CONSTRAINT "equity_events_equityAccountId_fkey" FOREIGN KEY ("equityAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "discuss_channels" ADD CONSTRAINT "discuss_channels_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "discuss_messages" ADD CONSTRAINT "discuss_messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "discuss_messages" ADD CONSTRAINT "discuss_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "discuss_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "discuss_messages" ADD CONSTRAINT "discuss_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sign_requests" ADD CONSTRAINT "sign_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "surveys" ADD CONSTRAINT "surveys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
