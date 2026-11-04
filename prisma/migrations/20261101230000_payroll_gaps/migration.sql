-- Payroll gaps: settle accrued wages, attendance overrides, Approvals PAYROLL, settlement journal source.

ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'PAYROLL_SETTLEMENT';
ALTER TYPE "ApprovalEntityType" ADD VALUE IF NOT EXISTS 'PAYROLL';

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "settlementJournalId" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_runs_settlementJournalId_key'
  ) THEN
    ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_settlementJournalId_key" UNIQUE ("settlementJournalId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_runs_settlementJournalId_fkey'
  ) THEN
    ALTER TABLE "payroll_runs"
      ADD CONSTRAINT "payroll_runs_settlementJournalId_fkey"
      FOREIGN KEY ("settlementJournalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "payslips"
  ADD COLUMN IF NOT EXISTS "workedDaysOverride" INTEGER,
  ADD COLUMN IF NOT EXISTS "workedHoursOverride" DECIMAL(19, 4),
  ADD COLUMN IF NOT EXISTS "overtimeAmountOverride" DECIMAL(19, 4);
