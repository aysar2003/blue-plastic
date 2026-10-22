-- Statements that filter journal_lines by organisation and date (P&L, cash flow,
-- trial balance range) were using (orgId, accountId, journalDate) and scanning
-- every account. A plain (orgId, journalDate) covering index matches that shape.
CREATE INDEX IF NOT EXISTS "journal_lines_orgId_journalDate_idx"
  ON "journal_lines" ("orgId", "journalDate");
