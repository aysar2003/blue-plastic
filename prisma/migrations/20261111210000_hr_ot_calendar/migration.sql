-- Multi-tier overtime and explicit work weekdays for payroll calendar.

ALTER TABLE "hr_settings" ADD COLUMN IF NOT EXISTS "overtimeRules" JSONB;
ALTER TABLE "hr_settings" ADD COLUMN IF NOT EXISTS "workWeekdays" JSONB;
