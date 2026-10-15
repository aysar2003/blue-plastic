-- Document approvals (SOX / maker-checker): policies, requests, decisions.

CREATE TYPE "ApprovalEntityType" AS ENUM (
  'SALES_DOCUMENT',
  'PURCHASE_DOCUMENT',
  'CUSTOMER_PAYMENT',
  'BILL_PAYMENT',
  'JOURNAL',
  'INVENTORY_ADJUSTMENT',
  'BANK_TRANSFER',
  'DEPOSIT',
  'CUSTOMER',
  'VENDOR'
);

CREATE TYPE "ApprovalRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REJECT';

ALTER TYPE "SalesDocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "PurchaseDocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

CREATE TABLE "approval_policies" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "minAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "requireDifferentApprover" BOOLEAN NOT NULL DEFAULT true,
  "levels" SMALLINT NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_policies_orgId_entityType_key" ON "approval_policies"("orgId", "entityType");
CREATE INDEX "approval_policies_orgId_enabled_idx" ON "approval_policies"("orgId", "enabled");

ALTER TABLE "approval_policies"
  ADD CONSTRAINT "approval_policies_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "approval_requests" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" "ApprovalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "amount" DECIMAL(19,4),
  "currencyCode" CHAR(3),
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "currentLevel" SMALLINT NOT NULL DEFAULT 1,
  "requiredLevels" SMALLINT NOT NULL DEFAULT 1,
  "note" TEXT,
  "submittedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_requests_orgId_status_submittedAt_idx" ON "approval_requests"("orgId", "status", "submittedAt");
CREATE INDEX "approval_requests_orgId_entityType_entityId_idx" ON "approval_requests"("orgId", "entityType", "entityId");
CREATE INDEX "approval_requests_submittedById_idx" ON "approval_requests"("submittedById");

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "approval_decisions" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "level" SMALLINT NOT NULL,
  "decision" "ApprovalRequestStatus" NOT NULL,
  "note" TEXT,
  "decidedById" TEXT NOT NULL,
  "decidedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_decisions_requestId_idx" ON "approval_decisions"("requestId");
CREATE INDEX "approval_decisions_orgId_decidedAt_idx" ON "approval_decisions"("orgId", "decidedAt");

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
