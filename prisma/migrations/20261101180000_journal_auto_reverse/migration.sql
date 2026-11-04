-- Phase 11.8: mark a manual accrual to reverse on the first day of the next period.
ALTER TABLE "journals"
  ADD COLUMN IF NOT EXISTS "autoReverse" BOOLEAN NOT NULL DEFAULT false;
