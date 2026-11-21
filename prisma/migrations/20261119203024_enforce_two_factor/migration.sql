-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EnforceTwoFactor" AS ENUM ('OFF', 'STAFF', 'ALL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "enforceTwoFactor" "EnforceTwoFactor" NOT NULL DEFAULT 'OFF';