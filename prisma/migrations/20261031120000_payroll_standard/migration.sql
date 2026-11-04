-- Standard payroll: structures, pay method, liabilities, advances, end of service.

CREATE TYPE "PayMethod" AS ENUM ('CASH', 'BANK', 'MOBILE');
CREATE TYPE "PayrollPayMode" AS ENUM ('IMMEDIATE', 'ACCRUE');
CREATE TYPE "SalaryCalc" AS ENUM ('BASE', 'FIXED', 'PERCENT');
CREATE TYPE "SalaryRuleKind" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER');
CREATE TYPE "AdvanceKind" AS ENUM ('LOAN', 'ADVANCE');

ALTER TABLE "employees" ADD COLUMN "payMethod" "PayMethod" NOT NULL DEFAULT 'CASH';
ALTER TABLE "employees" ADD COLUMN "payAccountId" TEXT;
ALTER TABLE "employees" ADD COLUMN "structureId" TEXT;

ALTER TABLE "payroll_runs" ADD COLUMN "payMode" "PayrollPayMode" NOT NULL DEFAULT 'IMMEDIATE';
ALTER TABLE "payroll_runs" ADD COLUMN "awaitingApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payroll_runs" ADD COLUMN "liabilityAccountId" TEXT;

ALTER TABLE "payslips" ADD COLUMN "employer" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "payslips" ADD COLUMN "number" TEXT;
ALTER TABLE "payslips" ADD COLUMN "included" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "payslip_lines" ADD COLUMN "affectsNet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "payslip_lines" ADD COLUMN "expenseAccountId" TEXT;
ALTER TABLE "payslip_lines" ADD COLUMN "liabilityAccountId" TEXT;
ALTER TABLE "payslip_lines" ADD COLUMN "advanceId" TEXT;

CREATE UNIQUE INDEX "payslips_orgId_number_key" ON "payslips"("orgId", "number");

CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_structures_orgId_name_key" ON "salary_structures"("orgId", "name");
CREATE INDEX "salary_structures_orgId_active_idx" ON "salary_structures"("orgId", "active");

CREATE TABLE "salary_rules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryRuleKind" NOT NULL,
    "calc" "SalaryCalc" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT,
    "liabilityAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "salary_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_rules_structureId_code_key" ON "salary_rules"("structureId", "code");
CREATE INDEX "salary_rules_orgId_structureId_idx" ON "salary_rules"("orgId", "structureId");

CREATE TABLE "employee_advances" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "AdvanceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "principal" DECIMAL(19,4) NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL,
    "installment" DECIMAL(19,4) NOT NULL,
    "accountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "employee_advances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_advances_orgId_employeeId_active_idx" ON "employee_advances"("orgId", "employeeId", "active");

CREATE TABLE "advance_recoveries" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advance_recoveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "advance_recoveries_advanceId_payslipId_key" ON "advance_recoveries"("advanceId", "payslipId");
CREATE INDEX "advance_recoveries_orgId_payslipId_idx" ON "advance_recoveries"("orgId", "payslipId");

CREATE TABLE "end_of_service" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "asOf" DATE NOT NULL,
    "years" DECIMAL(19,4) NOT NULL,
    "monthlyWage" DECIMAL(19,4) NOT NULL,
    "monthsPerYear" DECIMAL(19,4) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "memo" TEXT,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "journalId" TEXT,
    "expenseAccountId" TEXT,
    "payAccountId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "end_of_service_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "end_of_service_journalId_key" ON "end_of_service"("journalId");
CREATE INDEX "end_of_service_orgId_status_idx" ON "end_of_service"("orgId", "status");
CREATE INDEX "end_of_service_orgId_employeeId_idx" ON "end_of_service"("orgId", "employeeId");

ALTER TABLE "employees" ADD CONSTRAINT "employees_payAccountId_fkey" FOREIGN KEY ("payAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "salary_structures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_liabilityAccountId_fkey" FOREIGN KEY ("liabilityAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "salary_rules" ADD CONSTRAINT "salary_rules_liabilityAccountId_fkey" FOREIGN KEY ("liabilityAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "employee_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advance_recoveries" ADD CONSTRAINT "advance_recoveries_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_payAccountId_fkey" FOREIGN KEY ("payAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_of_service" ADD CONSTRAINT "end_of_service_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "salary_structures";
CREATE POLICY erp_no_direct_access ON "salary_structures" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "salary_rules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "salary_rules";
CREATE POLICY erp_no_direct_access ON "salary_rules" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "employee_advances" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "employee_advances";
CREATE POLICY erp_no_direct_access ON "employee_advances" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "advance_recoveries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "advance_recoveries";
CREATE POLICY erp_no_direct_access ON "advance_recoveries" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "end_of_service" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "end_of_service";
CREATE POLICY erp_no_direct_access ON "end_of_service" FOR ALL USING (false) WITH CHECK (false);
