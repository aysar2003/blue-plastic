-- P6/P7: institution onboarding completion + setup checklist progress.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMPTZ(6);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingChecklistDone" JSONB;

-- Existing companies already configured — do not force the wizard on them.
UPDATE "organizations"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE "onboardingCompletedAt" IS NULL;
