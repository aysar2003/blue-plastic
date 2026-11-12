-- Break-glass audit + one-time login tickets + (optional) least-privilege app role docs via sql/.

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'BREAK_GLASS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "login_tickets" (
  "jti" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_tickets_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX IF NOT EXISTS "login_tickets_userId_expiresAt_idx" ON "login_tickets"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "login_tickets_expiresAt_idx" ON "login_tickets"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'login_tickets_userId_fkey'
  ) THEN
    ALTER TABLE "login_tickets"
      ADD CONSTRAINT "login_tickets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
