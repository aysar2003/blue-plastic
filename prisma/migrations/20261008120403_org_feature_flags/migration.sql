-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB;
