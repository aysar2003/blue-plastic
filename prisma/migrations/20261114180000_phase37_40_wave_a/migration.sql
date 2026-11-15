-- Phase 37–40 Wave A LITE

-- Document types
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SERVICE_JOB';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SALES_CONTRACT';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CAPA_NOTE';

-- System account
ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'RETENTION_PAYABLE';

-- Enums
CREATE TYPE "ServiceJobStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'DONE', 'CANCELLED');
CREATE TYPE "ServiceJobLineKind" AS ENUM ('PART', 'LABOR', 'TRAVEL');
CREATE TYPE "SalesContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DONE', 'CANCELLED');
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- Organization localization
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "localizationPackId" TEXT;

-- Store van flag
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "isVan" BOOLEAN NOT NULL DEFAULT false;

-- Purchase retention (vendor, lite)
ALTER TABLE "purchase_documents" ADD COLUMN IF NOT EXISTS "retentionAmount" DECIMAL(19,4);
ALTER TABLE "purchase_documents" ADD COLUMN IF NOT EXISTS "retentionReleasedAt" TIMESTAMPTZ(6);

-- Workspace document sign link
ALTER TABLE "workspace_documents" ADD COLUMN IF NOT EXISTS "signRequestId" TEXT;

-- Service jobs
CREATE TABLE IF NOT EXISTS "service_jobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "assigneeId" TEXT,
    "vanStoreId" TEXT,
    "status" "ServiceJobStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "memo" TEXT,
    "salesDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_jobs_orgId_number_key" ON "service_jobs"("orgId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "service_jobs_salesDocumentId_key" ON "service_jobs"("salesDocumentId");
CREATE INDEX IF NOT EXISTS "service_jobs_orgId_status_date_idx" ON "service_jobs"("orgId", "status", "date" DESC);
CREATE INDEX IF NOT EXISTS "service_jobs_orgId_customerId_idx" ON "service_jobs"("orgId", "customerId");
CREATE INDEX IF NOT EXISTS "service_jobs_orgId_assigneeId_idx" ON "service_jobs"("orgId", "assigneeId");

CREATE TABLE IF NOT EXISTS "service_job_lines" (
    "id" TEXT NOT NULL,
    "serviceJobId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "lineNumber" SMALLINT NOT NULL,
    "kind" "ServiceJobLineKind" NOT NULL,
    "itemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "vanStoreId" TEXT,

    CONSTRAINT "service_job_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_job_lines_serviceJobId_lineNumber_key" ON "service_job_lines"("serviceJobId", "lineNumber");
CREATE INDEX IF NOT EXISTS "service_job_lines_orgId_itemId_idx" ON "service_job_lines"("orgId", "itemId");

-- Sales contracts
CREATE TABLE IF NOT EXISTS "sales_contracts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "projectId" TEXT,
    "contractValue" DECIMAL(19,4) NOT NULL,
    "status" "SalesContractStatus" NOT NULL DEFAULT 'DRAFT',
    "memo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sales_contracts_orgId_number_key" ON "sales_contracts"("orgId", "number");
CREATE INDEX IF NOT EXISTS "sales_contracts_orgId_status_updatedAt_idx" ON "sales_contracts"("orgId", "status", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "contract_milestones" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "lineNumber" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(7,4) NOT NULL,
    "billedAt" TIMESTAMPTZ(6),
    "salesDocumentId" TEXT,

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_milestones_contractId_lineNumber_key" ON "contract_milestones"("contractId", "lineNumber");
CREATE INDEX IF NOT EXISTS "contract_milestones_orgId_contractId_idx" ON "contract_milestones"("orgId", "contractId");

-- CAPA
CREATE TABLE IF NOT EXISTS "capa_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "workspaceDocumentId" TEXT,
    "signRequestId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capa_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "capa_notes_orgId_number_key" ON "capa_notes"("orgId", "number");
CREATE INDEX IF NOT EXISTS "capa_notes_orgId_status_updatedAt_idx" ON "capa_notes"("orgId", "status", "updatedAt" DESC);

-- Foreign keys
ALTER TABLE "workspace_documents" DROP CONSTRAINT IF EXISTS "workspace_documents_signRequestId_fkey";
ALTER TABLE "workspace_documents" ADD CONSTRAINT "workspace_documents_signRequestId_fkey" FOREIGN KEY ("signRequestId") REFERENCES "sign_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_orgId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_customerId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_projectId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_assigneeId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_vanStoreId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_vanStoreId_fkey" FOREIGN KEY ("vanStoreId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_jobs" DROP CONSTRAINT IF EXISTS "service_jobs_salesDocumentId_fkey";
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_job_lines" DROP CONSTRAINT IF EXISTS "service_job_lines_serviceJobId_fkey";
ALTER TABLE "service_job_lines" ADD CONSTRAINT "service_job_lines_serviceJobId_fkey" FOREIGN KEY ("serviceJobId") REFERENCES "service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_job_lines" DROP CONSTRAINT IF EXISTS "service_job_lines_itemId_fkey";
ALTER TABLE "service_job_lines" ADD CONSTRAINT "service_job_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_job_lines" DROP CONSTRAINT IF EXISTS "service_job_lines_vanStoreId_fkey";
ALTER TABLE "service_job_lines" ADD CONSTRAINT "service_job_lines_vanStoreId_fkey" FOREIGN KEY ("vanStoreId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_contracts" DROP CONSTRAINT IF EXISTS "sales_contracts_orgId_fkey";
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contracts" DROP CONSTRAINT IF EXISTS "sales_contracts_customerId_fkey";
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_contracts" DROP CONSTRAINT IF EXISTS "sales_contracts_projectId_fkey";
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contract_milestones" DROP CONSTRAINT IF EXISTS "contract_milestones_contractId_fkey";
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_milestones" DROP CONSTRAINT IF EXISTS "contract_milestones_salesDocumentId_fkey";
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "sales_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "capa_notes" DROP CONSTRAINT IF EXISTS "capa_notes_orgId_fkey";
ALTER TABLE "capa_notes" ADD CONSTRAINT "capa_notes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_notes" DROP CONSTRAINT IF EXISTS "capa_notes_workspaceDocumentId_fkey";
ALTER TABLE "capa_notes" ADD CONSTRAINT "capa_notes_workspaceDocumentId_fkey" FOREIGN KEY ("workspaceDocumentId") REFERENCES "workspace_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_notes" DROP CONSTRAINT IF EXISTS "capa_notes_signRequestId_fkey";
ALTER TABLE "capa_notes" ADD CONSTRAINT "capa_notes_signRequestId_fkey" FOREIGN KEY ("signRequestId") REFERENCES "sign_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;