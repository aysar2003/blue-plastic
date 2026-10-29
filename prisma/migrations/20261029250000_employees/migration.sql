-- Company HR directory (Odoo Employees). Does not touch the ledger or Membership.
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "workEmail" TEXT,
    "workPhone" TEXT,
    "mobile" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hiredAt" DATE,
    "userId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_orgId_userId_key" ON "employees"("orgId", "userId");
CREATE INDEX "employees_orgId_active_idx" ON "employees"("orgId", "active");
CREATE INDEX "employees_orgId_name_idx" ON "employees"("orgId", "name");

ALTER TABLE "employees" ADD CONSTRAINT "employees_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "employees";
CREATE POLICY erp_no_direct_access ON "employees" FOR ALL USING (false) WITH CHECK (false);
