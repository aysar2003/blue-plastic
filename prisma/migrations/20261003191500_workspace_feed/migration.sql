-- Shortcuts, pins, bank-feed choices, rules, report notes, and receipt files.
-- Reconciliation tables are not changed.

ALTER TABLE "imported_transactions" ADD COLUMN IF NOT EXISTS "categoryAccountId" TEXT;
ALTER TABLE "imported_transactions" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "imported_transactions" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

CREATE TABLE IF NOT EXISTS "workspace_bookmarks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_rules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contains" TEXT NOT NULL,
    "accountId" TEXT,
    "categoryAccountId" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "bank_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "report_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "report_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ledger_files" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "importedTransactionId" TEXT,
    "journalId" TEXT,
    "purchaseDocumentId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "ledger_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_bookmarks_orgId_userId_kind_sort_idx" ON "workspace_bookmarks"("orgId", "userId", "kind", "sort");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_bookmarks_orgId_userId_href_kind_key" ON "workspace_bookmarks"("orgId", "userId", "href", "kind");
CREATE INDEX IF NOT EXISTS "bank_rules_orgId_active_idx" ON "bank_rules"("orgId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "report_notes_orgId_reportKey_key" ON "report_notes"("orgId", "reportKey");
CREATE INDEX IF NOT EXISTS "ledger_files_orgId_importedTransactionId_idx" ON "ledger_files"("orgId", "importedTransactionId");
CREATE INDEX IF NOT EXISTS "ledger_files_orgId_journalId_idx" ON "ledger_files"("orgId", "journalId");
CREATE INDEX IF NOT EXISTS "ledger_files_orgId_purchaseDocumentId_idx" ON "ledger_files"("orgId", "purchaseDocumentId");

DO $$ BEGIN
  ALTER TABLE "imported_transactions" ADD CONSTRAINT "imported_transactions_categoryAccountId_fkey" FOREIGN KEY ("categoryAccountId") REFERENCES "ledger_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imported_transactions" ADD CONSTRAINT "imported_transactions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "imported_transactions" ADD CONSTRAINT "imported_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "workspace_bookmarks" ADD CONSTRAINT "workspace_bookmarks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "workspace_bookmarks" ADD CONSTRAINT "workspace_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_categoryAccountId_fkey" FOREIGN KEY ("categoryAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "report_notes" ADD CONSTRAINT "report_notes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ledger_files" ADD CONSTRAINT "ledger_files_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ledger_files" ADD CONSTRAINT "ledger_files_importedTransactionId_fkey" FOREIGN KEY ("importedTransactionId") REFERENCES "imported_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ledger_files" ADD CONSTRAINT "ledger_files_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
