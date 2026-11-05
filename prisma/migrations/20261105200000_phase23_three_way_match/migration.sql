-- Phase 23: hard 3-way match hold on bill post.
DO $$ BEGIN
  ALTER TYPE "PurchaseDocumentStatus" ADD VALUE IF NOT EXISTS 'MATCH_HOLD';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "purchase_documents"
  ADD COLUMN IF NOT EXISTS "matchVarianceNote" TEXT,
  ADD COLUMN IF NOT EXISTS "matchVarianceApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "matchApprovedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "matchApprovedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "purchase_documents"
    ADD CONSTRAINT "purchase_documents_matchApprovedById_fkey"
    FOREIGN KEY ("matchApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
