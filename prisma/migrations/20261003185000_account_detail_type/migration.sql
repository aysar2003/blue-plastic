-- A finer label under the account subtype. It does not change how the books post.
ALTER TABLE "ledger_accounts" ADD COLUMN IF NOT EXISTS "detailType" TEXT;
