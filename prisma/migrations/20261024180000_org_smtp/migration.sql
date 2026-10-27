-- Per-company outbound SMTP (Gmail App Password or domain mailbox).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpPort" SMALLINT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "smtpPasswordSealed" TEXT;
