-- Odoo-style POS cash control: cash in/out + session close variance hit the ledger.
-- Per-method payment posting is application-level (posPostedAccounts).

ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'POS_CASH_SHORT';
ALTER TYPE "SystemAccountKey" ADD VALUE IF NOT EXISTS 'POS_CASH_OVER';

ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'POS_CASH_MOVE';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'POS_SESSION_CLOSE';

ALTER TABLE "pos_sessions" ADD COLUMN "expectedCashAtClose" DECIMAL(19,4);
ALTER TABLE "pos_sessions" ADD COLUMN "cashDifference" DECIMAL(19,4);
ALTER TABLE "pos_sessions" ADD COLUMN "closingJournalId" TEXT;

CREATE UNIQUE INDEX "pos_sessions_closingJournalId_key" ON "pos_sessions"("closingJournalId");

ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_closingJournalId_fkey" FOREIGN KEY ("closingJournalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_movements" ADD COLUMN "counterpartyAccountId" TEXT;
ALTER TABLE "pos_cash_movements" ADD COLUMN "journalId" TEXT;

CREATE UNIQUE INDEX "pos_cash_movements_journalId_key" ON "pos_cash_movements"("journalId");

ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_counterpartyAccountId_fkey" FOREIGN KEY ("counterpartyAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
