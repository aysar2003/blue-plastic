-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "fiscalYearStartDay" SMALLINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "company_signup_requests" ADD COLUMN IF NOT EXISTS "fiscalYearStartDay" INTEGER NOT NULL DEFAULT 1;