-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_lastSeenAt_idx" ON "users"("lastSeenAt");
