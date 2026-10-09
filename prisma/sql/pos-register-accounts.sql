-- One POS Banks heading per organisation, and one chart account per register.
--
-- The app identifies the heading by detailType and each till by the description
-- `POS register <id>` (lib/pos-register-account.ts). These indexes make a second
-- backfill fail instead of inserting a duplicate. Idempotent so db:harden can
-- re-apply this file.

DROP INDEX IF EXISTS ledger_accounts_one_pos_banks;
CREATE UNIQUE INDEX ledger_accounts_one_pos_banks
  ON ledger_accounts ("orgId")
  WHERE "detailType" = 'POS Banks';

DROP INDEX IF EXISTS ledger_accounts_one_pos_register;
CREATE UNIQUE INDEX ledger_accounts_one_pos_register
  ON ledger_accounts ("orgId", description)
  WHERE "detailType" = 'POS register';
