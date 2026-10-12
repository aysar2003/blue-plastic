-- Per-company access restriction, rent/time limit, and max users.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "accessRestricted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "rentExpiresAt" TIMESTAMPTZ(6);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "rentNote" TEXT;
