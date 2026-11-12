-- Attendance: indexed token lookup (sha256) before bcrypt verify.
ALTER TABLE "attendance_devices" ADD COLUMN IF NOT EXISTS "tokenLookup" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_devices_tokenLookup_key" ON "attendance_devices"("tokenLookup");

-- Sign requests: public link expiry.
ALTER TABLE "sign_requests" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ(6);

-- Backfill expiry for open public links (14 days from creation).
UPDATE "sign_requests"
SET "expiresAt" = "createdAt" + INTERVAL '14 days'
WHERE "token" IS NOT NULL
  AND "expiresAt" IS NULL
  AND "status" IN ('DRAFT', 'SENT');
