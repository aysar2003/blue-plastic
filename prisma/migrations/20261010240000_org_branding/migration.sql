-- Company mark + logo for the shell brand (Settings → Organisation).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brandMark" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logoStorageKey" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logoContentType" TEXT;
