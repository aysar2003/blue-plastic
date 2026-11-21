-- Wave F deepen: inbound sign webhook retry/log table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SignWebhookEventStatus') THEN
    CREATE TYPE "SignWebhookEventStatus" AS ENUM ('RECEIVED', 'APPLIED', 'FAILED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sign_webhook_events" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "signRequestId" TEXT,
  "externalId" TEXT,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signatureOk" BOOLEAN NOT NULL,
  "status" "SignWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sign_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sign_webhook_events_orgId_status_createdAt_idx"
  ON "sign_webhook_events"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "sign_webhook_events_orgId_signRequestId_idx"
  ON "sign_webhook_events"("orgId", "signRequestId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sign_webhook_events_orgId_fkey'
  ) THEN
    ALTER TABLE "sign_webhook_events"
      ADD CONSTRAINT "sign_webhook_events_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sign_webhook_events_signRequestId_fkey'
  ) THEN
    ALTER TABLE "sign_webhook_events"
      ADD CONSTRAINT "sign_webhook_events_signRequestId_fkey"
      FOREIGN KEY ("signRequestId") REFERENCES "sign_requests"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
