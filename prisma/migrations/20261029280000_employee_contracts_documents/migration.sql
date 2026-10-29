-- Employee contracts + HR documents (Odoo-style lite).

CREATE TYPE "EmployeeContractState" AS ENUM ('DRAFT', 'OPEN', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EmployeeDocumentKind" AS ENUM ('CONTRACT', 'ID', 'CERTIFICATE', 'OTHER');

CREATE TABLE "employee_contracts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "EmployeeContractState" NOT NULL DEFAULT 'DRAFT',
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE,
    "wageType" "WageType" NOT NULL DEFAULT 'MONTHLY',
    "wageAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "jobTitle" TEXT,
    "notes" TEXT,
    "originalName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_contracts_orgId_state_idx" ON "employee_contracts"("orgId", "state");
CREATE INDEX "employee_contracts_orgId_employeeId_idx" ON "employee_contracts"("orgId", "employeeId");
CREATE INDEX "employee_contracts_orgId_dateStart_idx" ON "employee_contracts"("orgId", "dateStart");
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_contracts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "employee_contracts";
CREATE POLICY erp_no_direct_access ON "employee_contracts" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "EmployeeDocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_documents_orgId_employeeId_kind_idx" ON "employee_documents"("orgId", "employeeId", "kind");
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "employee_documents";
CREATE POLICY erp_no_direct_access ON "employee_documents" FOR ALL USING (false) WITH CHECK (false);
