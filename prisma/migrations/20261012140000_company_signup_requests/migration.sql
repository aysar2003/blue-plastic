-- CreateEnum (idempotent — may already exist from a partial apply)
DO $$ BEGIN
  CREATE TYPE "CompanySignupStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_signup_requests" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "CompanySignupStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_signup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_signup_requests_status_createdAt_idx" ON "company_signup_requests"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_signup_requests_email_status_idx" ON "company_signup_requests"("email", "status");
