-- Leave, attendance, payroll (Employees module). Ledger posts use JournalSourceType.PAYROLL.

ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'PAYROLL';

CREATE TYPE "WageType" AS ENUM ('MONTHLY', 'DAILY');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REFUSED', 'CANCELLED');
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED');
CREATE TYPE "PayslipLineKind" AS ENUM ('EARNING', 'DEDUCTION');

ALTER TABLE "employees" ADD COLUMN "wageType" "WageType" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "employees" ADD COLUMN "wageAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "expenseAccountId" TEXT;
ALTER TABLE "employees" ADD COLUMN "payableAccountId" TEXT;

ALTER TABLE "employees" ADD CONSTRAINT "employees_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "daysPerYear" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_types_orgId_name_key" ON "leave_types"("orgId", "name");
CREATE INDEX "leave_types_orgId_active_idx" ON "leave_types"("orgId", "active");
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "leave_types";
CREATE POLICY erp_no_direct_access ON "leave_types" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "leave_allocations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "leave_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_allocations_employeeId_leaveTypeId_year_key" ON "leave_allocations"("employeeId", "leaveTypeId", "year");
CREATE INDEX "leave_allocations_orgId_year_idx" ON "leave_allocations"("orgId", "year");
ALTER TABLE "leave_allocations" ADD CONSTRAINT "leave_allocations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_allocations" ADD CONSTRAINT "leave_allocations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_allocations" ADD CONSTRAINT "leave_allocations_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_allocations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "leave_allocations";
CREATE POLICY erp_no_direct_access ON "leave_allocations" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "days" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ(6),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_requests_orgId_status_idx" ON "leave_requests"("orgId", "status");
CREATE INDEX "leave_requests_orgId_employeeId_dateFrom_idx" ON "leave_requests"("orgId", "employeeId", "dateFrom");
CREATE INDEX "leave_requests_orgId_leaveTypeId_idx" ON "leave_requests"("orgId", "leaveTypeId");
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "leave_requests";
CREATE POLICY erp_no_direct_access ON "leave_requests" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "attendance_days" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMPTZ(6),
    "checkOut" TIMESTAMPTZ(6),
    "workedHours" DECIMAL(19,4),
    "note" TEXT,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_days_employeeId_date_key" ON "attendance_days"("employeeId", "date");
CREATE INDEX "attendance_days_orgId_date_idx" ON "attendance_days"("orgId", "date");
CREATE INDEX "attendance_days_orgId_employeeId_idx" ON "attendance_days"("orgId", "employeeId");
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_days" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "attendance_days";
CREATE POLICY erp_no_direct_access ON "attendance_days" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "memo" TEXT,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "journalId" TEXT,
    "postedAt" TIMESTAMPTZ(6),
    "payFromAccountId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_runs_journalId_key" ON "payroll_runs"("journalId");
CREATE INDEX "payroll_runs_orgId_status_idx" ON "payroll_runs"("orgId", "status");
CREATE INDEX "payroll_runs_orgId_periodStart_periodEnd_idx" ON "payroll_runs"("orgId", "periodStart", "periodEnd");
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payFromAccountId_fkey" FOREIGN KEY ("payFromAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "payroll_runs";
CREATE POLICY erp_no_direct_access ON "payroll_runs" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "gross" DECIMAL(19,4) NOT NULL,
    "deductions" DECIMAL(19,4) NOT NULL,
    "net" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payslips_runId_employeeId_key" ON "payslips"("runId", "employeeId");
CREATE INDEX "payslips_orgId_employeeId_idx" ON "payslips"("orgId", "employeeId");
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_runId_fkey" FOREIGN KEY ("runId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "payslips";
CREATE POLICY erp_no_direct_access ON "payslips" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "payslip_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "kind" "PayslipLineKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payslip_lines_payslipId_sortOrder_idx" ON "payslip_lines"("payslipId", "sortOrder");
CREATE INDEX "payslip_lines_orgId_idx" ON "payslip_lines"("orgId");
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslip_lines" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "payslip_lines";
CREATE POLICY erp_no_direct_access ON "payslip_lines" FOR ALL USING (false) WITH CHECK (false);
