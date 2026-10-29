-- Odoo-style employee card fields (no payroll / leave / attendance).
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'CONTRACTOR', 'INTERN');

ALTER TABLE "employees" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "employees" ADD COLUMN "workStreet" TEXT;
ALTER TABLE "employees" ADD COLUMN "workCity" TEXT;
ALTER TABLE "employees" ADD COLUMN "workCountry" TEXT;
ALTER TABLE "employees" ADD COLUMN "privateStreet" TEXT;
ALTER TABLE "employees" ADD COLUMN "privateCity" TEXT;
ALTER TABLE "employees" ADD COLUMN "privateCountry" TEXT;
ALTER TABLE "employees" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "employees" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "employees" ADD COLUMN "skills" TEXT;
ALTER TABLE "employees" ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "employees" ADD COLUMN "leftAt" DATE;
ALTER TABLE "employees" ADD COLUMN "managerId" TEXT;

CREATE INDEX "employees_orgId_managerId_idx" ON "employees"("orgId", "managerId");
CREATE INDEX "employees_orgId_department_idx" ON "employees"("orgId", "department");

ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
