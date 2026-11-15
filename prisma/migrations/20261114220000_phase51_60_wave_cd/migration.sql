-- Phase 51–60 Wave C/D LITE

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "franchiseRoyaltyPercent" DECIMAL(7,4);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "signProvider" JSONB;

CREATE TYPE "ShareholderMemberKind" AS ENUM ('MEMBER', 'INVESTOR');
ALTER TABLE "shareholders" ADD COLUMN IF NOT EXISTS "memberKind" "ShareholderMemberKind" NOT NULL DEFAULT 'INVESTOR';
ALTER TABLE "shareholders" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

ALTER TABLE "purchase_documents" ADD COLUMN IF NOT EXISTS "encumbered" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sales_document_lines" ADD COLUMN IF NOT EXISTS "sellerVendorId" TEXT;

ALTER TABLE "sign_requests" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE TYPE "SettlementBatchStatus" AS ENUM ('DRAFT', 'POSTED');
CREATE TYPE "LoanAccountStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULT');
CREATE TYPE "InsurancePolicyStatus" AS ENUM ('ACTIVE', 'LAPSED');

CREATE TABLE IF NOT EXISTS "marketplace_sellers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "commissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "marketplace_sellers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_sellers_orgId_vendorId_key" ON "marketplace_sellers"("orgId", "vendorId");
CREATE INDEX IF NOT EXISTS "marketplace_sellers_orgId_isActive_idx" ON "marketplace_sellers"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "settlement_batches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "SettlementBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "grossSales" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "commission" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "sellerPayable" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "settlement_batches_orgId_periodEnd_idx" ON "settlement_batches"("orgId", "periodEnd" DESC);

CREATE TABLE IF NOT EXISTS "loan_products" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultRate" DECIMAL(9,6) NOT NULL,
    "defaultTermMonths" SMALLINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "loan_products_orgId_name_key" ON "loan_products"("orgId", "name");

CREATE TABLE IF NOT EXISTS "loan_accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT,
    "principal" DECIMAL(19,4) NOT NULL,
    "annualRate" DECIMAL(9,6) NOT NULL,
    "termMonths" SMALLINT NOT NULL,
    "status" "LoanAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "loan_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "loan_accounts_orgId_status_idx" ON "loan_accounts"("orgId", "status");
CREATE INDEX IF NOT EXISTS "loan_accounts_customerId_idx" ON "loan_accounts"("customerId");

CREATE TABLE IF NOT EXISTS "loan_schedule_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "loanAccountId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalDue" DECIMAL(19,4) NOT NULL,
    "interestDue" DECIMAL(19,4) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "principalJournalId" TEXT,
    "interestJournalId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_schedule_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "loan_schedule_lines_orgId_loanAccountId_dueDate_idx" ON "loan_schedule_lines"("orgId", "loanAccountId", "dueDate");
CREATE INDEX IF NOT EXISTS "loan_schedule_lines_orgId_dueDate_paidAt_idx" ON "loan_schedule_lines"("orgId", "dueDate", "paidAt");

CREATE TABLE IF NOT EXISTS "insurance_policies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "premium" DECIMAL(19,4) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "InsurancePolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "recurringTemplateId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "insurance_policies_orgId_policyNumber_key" ON "insurance_policies"("orgId", "policyNumber");
CREATE INDEX IF NOT EXISTS "insurance_policies_orgId_status_endDate_idx" ON "insurance_policies"("orgId", "status", "endDate");

CREATE INDEX IF NOT EXISTS "shareholders_orgId_customerId_idx" ON "shareholders"("orgId", "customerId");
CREATE INDEX IF NOT EXISTS "sales_document_lines_orgId_sellerVendorId_idx" ON "sales_document_lines"("orgId", "sellerVendorId");
CREATE INDEX IF NOT EXISTS "sign_requests_orgId_externalId_idx" ON "sign_requests"("orgId", "externalId");

ALTER TABLE "shareholders" DROP CONSTRAINT IF EXISTS "shareholders_customerId_fkey";
ALTER TABLE "shareholders" ADD CONSTRAINT "shareholders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_document_lines" DROP CONSTRAINT IF EXISTS "sales_document_lines_sellerVendorId_fkey";
ALTER TABLE "sales_document_lines" ADD CONSTRAINT "sales_document_lines_sellerVendorId_fkey" FOREIGN KEY ("sellerVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marketplace_sellers" DROP CONSTRAINT IF EXISTS "marketplace_sellers_orgId_fkey";
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "marketplace_sellers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_sellers" DROP CONSTRAINT IF EXISTS "marketplace_sellers_vendorId_fkey";
ALTER TABLE "marketplace_sellers" ADD CONSTRAINT "marketplace_sellers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "settlement_batches" DROP CONSTRAINT IF EXISTS "settlement_batches_orgId_fkey";
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement_batches" DROP CONSTRAINT IF EXISTS "settlement_batches_journalId_fkey";
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_products" DROP CONSTRAINT IF EXISTS "loan_products_orgId_fkey";
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loan_accounts" DROP CONSTRAINT IF EXISTS "loan_accounts_orgId_fkey";
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_accounts" DROP CONSTRAINT IF EXISTS "loan_accounts_customerId_fkey";
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_accounts" DROP CONSTRAINT IF EXISTS "loan_accounts_productId_fkey";
ALTER TABLE "loan_accounts" ADD CONSTRAINT "loan_accounts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loan_schedule_lines" DROP CONSTRAINT IF EXISTS "loan_schedule_lines_orgId_fkey";
ALTER TABLE "loan_schedule_lines" ADD CONSTRAINT "loan_schedule_lines_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_schedule_lines" DROP CONSTRAINT IF EXISTS "loan_schedule_lines_loanAccountId_fkey";
ALTER TABLE "loan_schedule_lines" ADD CONSTRAINT "loan_schedule_lines_loanAccountId_fkey" FOREIGN KEY ("loanAccountId") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insurance_policies" DROP CONSTRAINT IF EXISTS "insurance_policies_orgId_fkey";
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_policies" DROP CONSTRAINT IF EXISTS "insurance_policies_customerId_fkey";
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insurance_policies" DROP CONSTRAINT IF EXISTS "insurance_policies_recurringTemplateId_fkey";
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "recurring_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;