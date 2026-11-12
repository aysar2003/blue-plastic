-- Progressive tax / salary rule slabs on standard payroll.

ALTER TYPE "SalaryCalc" ADD VALUE IF NOT EXISTS 'SLABS';

ALTER TABLE "salary_rules" ADD COLUMN IF NOT EXISTS "slabs" JSONB;
