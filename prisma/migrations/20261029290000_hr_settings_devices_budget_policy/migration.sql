-- HR settings, attendance devices/punches, HR budget, HR policies.

ALTER TYPE "WageType" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "AttendanceSource" ADD VALUE IF NOT EXISTS 'DEVICE';

CREATE TYPE "AttendanceDeviceKind" AS ENUM ('GENERIC_HTTP', 'ZKTECO', 'ANVIZ', 'OTHER');
CREATE TYPE "AttendancePunchKind" AS ENUM ('IN', 'OUT', 'UNKNOWN');

CREATE TABLE "hr_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "hoursPerDay" DECIMAL(19,4) NOT NULL DEFAULT 8,
    "workDaysPerWeek" INTEGER NOT NULL DEFAULT 6,
    "overtimeAfterHoursPerDay" DECIMAL(19,4) NOT NULL DEFAULT 8,
    "overtimeMultiplier" DECIMAL(19,4) NOT NULL DEFAULT 1.5,
    "timezoneNote" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hr_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_settings_orgId_key" ON "hr_settings"("orgId");
ALTER TABLE "hr_settings" ADD CONSTRAINT "hr_settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "hr_settings";
CREATE POLICY erp_no_direct_access ON "hr_settings" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "attendance_devices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AttendanceDeviceKind" NOT NULL DEFAULT 'GENERIC_HTTP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "externalKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_devices_orgId_externalKey_key" ON "attendance_devices"("orgId", "externalKey");
CREATE UNIQUE INDEX "attendance_devices_orgId_name_key" ON "attendance_devices"("orgId", "name");
CREATE INDEX "attendance_devices_orgId_active_idx" ON "attendance_devices"("orgId", "active");
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_devices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "attendance_devices";
CREATE POLICY erp_no_direct_access ON "attendance_devices" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "attendance_device_users" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_device_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_device_users_deviceId_externalUserId_key" ON "attendance_device_users"("deviceId", "externalUserId");
CREATE INDEX "attendance_device_users_orgId_employeeId_idx" ON "attendance_device_users"("orgId", "employeeId");
ALTER TABLE "attendance_device_users" ADD CONSTRAINT "attendance_device_users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_device_users" ADD CONSTRAINT "attendance_device_users_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_device_users" ADD CONSTRAINT "attendance_device_users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_device_users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "attendance_device_users";
CREATE POLICY erp_no_direct_access ON "attendance_device_users" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "attendance_punches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "punchedAt" TIMESTAMPTZ(6) NOT NULL,
    "kind" "AttendancePunchKind" NOT NULL DEFAULT 'UNKNOWN',
    "externalId" TEXT,
    "externalUserId" TEXT,
    "raw" JSONB,
    "attendanceDayId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_punches_orgId_deviceId_externalId_key" ON "attendance_punches"("orgId", "deviceId", "externalId");
CREATE INDEX "attendance_punches_orgId_punchedAt_idx" ON "attendance_punches"("orgId", "punchedAt");
CREATE INDEX "attendance_punches_orgId_employeeId_punchedAt_idx" ON "attendance_punches"("orgId", "employeeId", "punchedAt");
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_attendanceDayId_fkey" FOREIGN KEY ("attendanceDayId") REFERENCES "attendance_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "attendance_punches";
CREATE POLICY erp_no_direct_access ON "attendance_punches" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "hr_budgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hr_budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_budgets_orgId_year_key" ON "hr_budgets"("orgId", "year");
CREATE INDEX "hr_budgets_orgId_year_idx" ON "hr_budgets"("orgId", "year");
ALTER TABLE "hr_budgets" ADD CONSTRAINT "hr_budgets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_budgets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "hr_budgets";
CREATE POLICY erp_no_direct_access ON "hr_budgets" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "hr_budget_months" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "plannedWage" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "plannedHeadcount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "hr_budget_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hr_budget_months_budgetId_month_key" ON "hr_budget_months"("budgetId", "month");
CREATE INDEX "hr_budget_months_orgId_budgetId_idx" ON "hr_budget_months"("orgId", "budgetId");
ALTER TABLE "hr_budget_months" ADD CONSTRAINT "hr_budget_months_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "hr_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_budget_months" ADD CONSTRAINT "hr_budget_months_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_budget_months" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "hr_budget_months";
CREATE POLICY erp_no_direct_access ON "hr_budget_months" FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE "hr_policies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "storageKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "hr_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_policies_orgId_published_sortOrder_idx" ON "hr_policies"("orgId", "published", "sortOrder");
ALTER TABLE "hr_policies" ADD CONSTRAINT "hr_policies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_policies" ADD CONSTRAINT "hr_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hr_policies" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_no_direct_access ON "hr_policies";
CREATE POLICY erp_no_direct_access ON "hr_policies" FOR ALL USING (false) WITH CHECK (false);
