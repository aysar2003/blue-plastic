-- ---------------------------------------------------------------------------
-- Ledger integrity rules R1-R7 and R10  (docs/02-accounting-design.md §2)
--
-- These are the actual guarantee. The posting engine enforces the same rules
-- first, because it can produce a decent error message -- but application-level
-- enforcement is not enforcement: a psql session, a migration script or a future
-- service will bypass it. Everything below holds regardless of how the write
-- arrives.
--
-- This file is the readable source. It is applied verbatim by a migration, and
-- `pnpm db:verify` asserts every object here still exists in the database.
-- ---------------------------------------------------------------------------


-- R1 -- A line is a debit or a credit. Never both, never negative, never zero.
--
-- `(debit = 0) <> (credit = 0)` is an exclusive-or: exactly one side must be
-- non-zero. A zero-zero line is rejected too; the posting engine drops those
-- before they reach here.
ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_one_sided;
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_one_sided
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0) <> (credit = 0));


-- R2/R3 -- Every posted journal balances and has at least two lines.
--
-- A plain CHECK cannot express this: it spans rows. An immediate trigger cannot
-- either, because it would fire on the first line, when the journal is by
-- definition unbalanced. A DEFERRABLE INITIALLY DEFERRED constraint trigger fires
-- once, at COMMIT -- so lines may be inserted one at a time, and an unbalanced
-- journal simply cannot exist outside an open transaction, from any client.
CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger AS $$
DECLARE
  v_journal_id text := COALESCE(NEW."journalId", OLD."journalId");
  v_status     text;
  v_number     text;
  v_debit      numeric(19,4);
  v_credit     numeric(19,4);
  v_lines      integer;
BEGIN
  SELECT status::text, "journalNumber" INTO v_status, v_number
    FROM journals WHERE id = v_journal_id;

  -- The journal was deleted in this same transaction (only possible for drafts).
  IF v_status IS NULL THEN
    RETURN NULL;
  END IF;

  -- Drafts are working copies and may be unbalanced. Nothing reads them as ledger.
  IF v_status = 'DRAFT' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
    INTO v_debit, v_credit, v_lines
    FROM journal_lines WHERE "journalId" = v_journal_id;

  IF v_lines < 2 THEN
    RAISE EXCEPTION
      'Journal % has % line(s). Double-entry requires at least two.', v_number, v_lines
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION
      'Journal % is out of balance: debits %, credits %, difference %.',
      v_number, v_debit, v_credit, (v_debit - v_credit)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_balanced ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();


-- R4 -- A posted journal is immutable.
--
-- Two transitions are permitted, and nothing else: POSTED -> REVERSED, and
-- either of those -> DELETED. Comparing the rest of the row as jsonb catches
-- every other field in one expression, including any column added by a future
-- migration -- an allow-list of column names would silently stop protecting
-- whatever is added next.
--
-- DELETED is a soft delete and is the only thing "delete this transaction" does
-- to the ledger. The row is not removed, no amount changes, no line is touched;
-- the entry is marked so that every balance, register and report leaves it out.
-- The history of what was once posted survives in full, which is the whole
-- reason the physical row is kept. The deletion stamp must be set in the same
-- statement, so an entry can never be marked deleted without saying when and by
-- whom -- and the reverse transition does not exist: an entry cannot be
-- un-deleted by an UPDATE any more than it could be edited.
CREATE OR REPLACE FUNCTION forbid_posted_journal_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Company wipe / restore: the whole organisation is being removed.
    IF current_setting('app.allow_company_wipe', true) = 'on' THEN
      RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION
        'Journal % is posted and cannot be deleted. Post a reversal instead.', OLD."journalNumber"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- Marking an entry deleted. Permitted from POSTED and from REVERSED, and only
  -- when the stamp is set and absolutely nothing else about the row moves.
  IF NEW.status = 'DELETED' AND OLD.status IN ('POSTED', 'REVERSED') THEN
    IF NEW."deletedAt" IS NULL THEN
      RAISE EXCEPTION
        'Journal % cannot be marked deleted without recording when.', OLD."journalNumber"
        USING ERRCODE = 'check_violation';
    END IF;

    IF (to_jsonb(NEW) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
       = (to_jsonb(OLD) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Journal % cannot be changed while it is being deleted.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'DELETED' THEN
    RAISE EXCEPTION
      'Journal % has been deleted and cannot be changed.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'REVERSED' THEN
    RAISE EXCEPTION
      'Journal % has already been reversed and cannot be changed.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'POSTED' THEN
    IF NEW.status = 'REVERSED'
       AND (to_jsonb(NEW) - 'status' - 'updatedAt') = (to_jsonb(OLD) - 'status' - 'updatedAt')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Journal % is posted and immutable.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_immutable ON journals;
CREATE TRIGGER trg_journal_immutable
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_journal_mutation();


-- R4 (lines) -- Lines of a posted journal cannot be changed or removed.
CREATE OR REPLACE FUNCTION forbid_posted_line_mutation() RETURNS trigger AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_company_wipe', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT status::text INTO v_status
    FROM journals WHERE id = COALESCE(OLD."journalId", NEW."journalId");

  -- Journal already gone: a draft being deleted, cascading to its lines.
  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      'Journal lines cannot be changed once the journal is posted. Post a reversal instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_line_immutable ON journal_lines;
CREATE TRIGGER trg_journal_line_immutable
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_line_mutation();


-- R5/R6 -- A journal posts into an open period, and its date falls inside it.
CREATE OR REPLACE FUNCTION assert_period_accepts_posting() RETURNS trigger AS $$
DECLARE
  p RECORD;
BEGIN
  IF NEW.status = 'DRAFT' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM accounting_periods WHERE id = NEW."periodId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal % references an accounting period that does not exist.', NEW."journalNumber"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p."orgId" <> NEW."orgId" THEN
    RAISE EXCEPTION 'Journal % references another organisation''s accounting period.', NEW."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.date < p."startDate" OR NEW.date > p."endDate" THEN
    RAISE EXCEPTION
      'Journal date % falls outside its accounting period (% to %).',
      NEW.date, p."startDate", p."endDate"
      USING ERRCODE = 'check_violation';
  END IF;

  IF p.status <> 'OPEN' THEN
    RAISE EXCEPTION
      'The accounting period % to % is % and cannot accept postings.',
      p."startDate", p."endDate", lower(p.status::text)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_period_open ON journals;
CREATE TRIGGER trg_journal_period_open
  BEFORE INSERT ON journals
  FOR EACH ROW EXECUTE FUNCTION assert_period_accepts_posting();


-- R7 -- Control-account lines carry their subledger counterparty, and no line
-- posts to an inactive account or to a parent.
--
-- This trigger is also what keeps `journalDate` honest: rather than trusting the
-- caller's copy of the header date, it sets it. A denormalised column that can
-- drift is worse than no column at all.
CREATE OR REPLACE FUNCTION assert_line_dimensions() RETURNS trigger AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT "systemKey"::text AS system_key, "isActive", name, code
    INTO a
    FROM ledger_accounts
   WHERE id = NEW."accountId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal line references an account that does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NOT a."isActive" THEN
    RAISE EXCEPTION 'Account % (%) is archived and cannot receive postings.', a.code, a.name
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM ledger_accounts WHERE "parentId" = NEW."accountId") THEN
    RAISE EXCEPTION
      'Account % (%) has sub-accounts and is a grouping heading. Post to one of its sub-accounts.',
      a.code, a.name
      USING ERRCODE = 'check_violation';
  END IF;

  IF a.system_key = 'ACCOUNTS_RECEIVABLE' AND NEW."customerId" IS NULL THEN
    RAISE EXCEPTION
      'A line posted to Accounts Receivable must name a customer, or the aging report and the control account will disagree.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF a.system_key = 'ACCOUNTS_PAYABLE' AND NEW."vendorId" IS NULL THEN
    RAISE EXCEPTION
      'A line posted to Accounts Payable must name a vendor, or the aging report and the control account will disagree.'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW."journalDate" := (SELECT date FROM journals WHERE id = NEW."journalId");

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_line_dimensions ON journal_lines;
CREATE TRIGGER trg_journal_line_dimensions
  BEFORE INSERT ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION assert_line_dimensions();


-- R10 -- A system account cannot be deleted or have its systemKey reassigned.
--
-- Ordinary accounts are protected from deletion by the ON DELETE RESTRICT
-- foreign key from journal_lines; system accounts are protected unconditionally,
-- because the engine refers to them by name.
CREATE OR REPLACE FUNCTION protect_system_accounts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Company wipe / restore: the whole organisation is being removed.
    IF current_setting('app.allow_company_wipe', true) = 'on' THEN
      RETURN OLD;
    END IF;
    IF OLD."isSystem" THEN
      RAISE EXCEPTION
        'Account % (%) is a system account and cannot be deleted. Rename it if the wording does not suit you.',
        OLD.code, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."systemKey" IS DISTINCT FROM NEW."systemKey" THEN
    RAISE EXCEPTION
      'The system role of account % (%) cannot be changed.', OLD.code, OLD.name
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."isSystem" AND NOT NEW."isActive" THEN
    RAISE EXCEPTION
      'Account % (%) is a system account and cannot be archived.', OLD.code, OLD.name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_system_accounts ON ledger_accounts;
CREATE TRIGGER trg_protect_system_accounts
  BEFORE UPDATE OR DELETE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_system_accounts();


-- An account's type and subtype must agree. A "BANK" account classified as
-- REVENUE would corrupt every financial statement it appears on.
CREATE OR REPLACE FUNCTION assert_account_classification() RETURNS trigger AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected := CASE NEW.subtype::text
    WHEN 'BANK' THEN 'ASSET'
    WHEN 'ACCOUNTS_RECEIVABLE' THEN 'ASSET'
    WHEN 'UNDEPOSITED_FUNDS' THEN 'ASSET'
    WHEN 'INVENTORY' THEN 'ASSET'
    WHEN 'OTHER_CURRENT_ASSET' THEN 'ASSET'
    WHEN 'FIXED_ASSET' THEN 'ASSET'
    WHEN 'ACCUMULATED_DEPRECIATION' THEN 'ASSET'
    WHEN 'OTHER_ASSET' THEN 'ASSET'
    WHEN 'ACCOUNTS_PAYABLE' THEN 'LIABILITY'
    WHEN 'CREDIT_CARD' THEN 'LIABILITY'
    WHEN 'SALES_TAX_PAYABLE' THEN 'LIABILITY'
    WHEN 'OTHER_CURRENT_LIABILITY' THEN 'LIABILITY'
    WHEN 'LONG_TERM_LIABILITY' THEN 'LIABILITY'
    WHEN 'OWNERS_EQUITY' THEN 'EQUITY'
    WHEN 'RETAINED_EARNINGS' THEN 'EQUITY'
    WHEN 'OPENING_BALANCE_EQUITY' THEN 'EQUITY'
    WHEN 'DRAWINGS' THEN 'EQUITY'
    WHEN 'INCOME' THEN 'REVENUE'
    WHEN 'OTHER_INCOME' THEN 'REVENUE'
    WHEN 'SALES_DISCOUNTS' THEN 'REVENUE'
    WHEN 'COST_OF_GOODS_SOLD' THEN 'COGS'
    WHEN 'OPERATING_EXPENSE' THEN 'EXPENSE'
    WHEN 'OTHER_EXPENSE' THEN 'EXPENSE'
    WHEN 'DEPRECIATION' THEN 'EXPENSE'
  END;

  IF v_expected IS NULL OR v_expected <> NEW.type::text THEN
    RAISE EXCEPTION
      'Account subtype % does not belong to type % (it belongs to %).',
      NEW.subtype, NEW.type, COALESCE(v_expected, 'no type')
      USING ERRCODE = 'check_violation';
  END IF;

  -- A sub-account must sit under a parent of the same statement type.
  IF NEW."parentId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM ledger_accounts
       WHERE id = NEW."parentId" AND type = NEW.type AND "orgId" = NEW."orgId"
    ) THEN
      RAISE EXCEPTION
        'A sub-account must sit under a parent of the same type in the same organisation.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW."parentId" = NEW.id THEN
      RAISE EXCEPTION 'An account cannot be its own parent.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_classification ON ledger_accounts;
CREATE TRIGGER trg_account_classification
  BEFORE INSERT OR UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION assert_account_classification();


-- R9 -- A line cannot reference another organisation's journal or account.
--
-- These sit alongside the ordinary single-column foreign keys Prisma manages.
-- Prisma does not model them: it would then treat `orgId` as a relation scalar
-- owned by two relations and refuse to let a nested create set it. The guarantee
-- belongs in the database regardless, and keeping it here leaves the client API
-- usable. Their targets are the (id, "orgId") unique indexes on journals and
-- ledger_accounts.
ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_journal_org_fkey;
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_journal_org_fkey
  FOREIGN KEY ("journalId", "orgId") REFERENCES journals (id, "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_account_org_fkey;
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_account_org_fkey
  FOREIGN KEY ("accountId", "orgId") REFERENCES ledger_accounts (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
