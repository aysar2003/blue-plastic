-- Projects app: customer job folders linked to sales and purchase documents.

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PROJECT';

CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'DONE', 'CANCELLED');

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteLocation" TEXT,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "endDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_orgId_number_key" ON "projects"("orgId", "number");
CREATE UNIQUE INDEX "projects_id_orgId_key" ON "projects"("id", "orgId");
CREATE INDEX "projects_orgId_status_updatedAt_idx" ON "projects"("orgId", "status", "updatedAt" DESC);
CREATE INDEX "projects_orgId_customerId_updatedAt_idx" ON "projects"("orgId", "customerId", "updatedAt" DESC);

ALTER TABLE "projects" ADD CONSTRAINT "projects_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_documents" ADD COLUMN "projectId" TEXT;
CREATE INDEX "sales_documents_orgId_projectId_date_idx" ON "sales_documents"("orgId", "projectId", "date" DESC);
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_documents" ADD COLUMN "projectId" TEXT;
CREATE INDEX "purchase_documents_orgId_projectId_date_idx" ON "purchase_documents"("orgId", "projectId", "date" DESC);
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
