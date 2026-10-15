-- Prisma field is requestedModules (camelCase, matching the rest of this table).
-- 20261012220000 wrongly added snake_case requested_modules.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_signup_requests'
      AND column_name = 'requested_modules'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_signup_requests'
      AND column_name = 'requestedModules'
  ) THEN
    ALTER TABLE "company_signup_requests"
      RENAME COLUMN "requested_modules" TO "requestedModules";
  END IF;
END $$;