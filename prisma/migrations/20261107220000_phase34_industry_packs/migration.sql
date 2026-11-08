-- Phase 34: industry / institution pack id on the company.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "installedPackId" TEXT;
