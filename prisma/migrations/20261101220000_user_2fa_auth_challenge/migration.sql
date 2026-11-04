-- Optional 2FA + unique phone login alias.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecretSealed" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp2faEnabledAt" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");

CREATE TABLE IF NOT EXISTS "auth_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_challenges_userId_purpose_expiresAt_idx"
  ON "auth_challenges"("userId", "purpose", "expiresAt");

DO $$ BEGIN
  ALTER TABLE "auth_challenges"
    ADD CONSTRAINT "auth_challenges_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
