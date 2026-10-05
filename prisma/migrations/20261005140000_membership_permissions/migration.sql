-- Store-keeper + custom access roles, and per-member permission overrides.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STORE_KEEPER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "permissionsOverride" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "memberships"
SET "permissionsOverride" = ARRAY[]::TEXT[]
WHERE "permissionsOverride" IS NULL;
