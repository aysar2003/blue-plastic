-- ---------------------------------------------------------------------------
-- Banking integrity  (Phase 6)
-- ---------------------------------------------------------------------------


-- R9 -- Banking documents cannot cross organisations.
ALTER TABLE deposit_lines DROP CONSTRAINT IF EXISTS deposit_lines_deposit_org_fkey;
ALTER TABLE deposit_lines
  ADD CONSTRAINT deposit_lines_deposit_org_fkey
  FOREIGN KEY ("depositId", "orgId") REFERENCES deposits (id, "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- A transfer moves money between two *different* accounts.
--
-- A transfer to itself posts a debit and a credit to the same account. It nets to
-- nothing, balances perfectly, and is invisible on every report — which is
-- exactly why it should be impossible rather than merely discouraged.
ALTER TABLE bank_transfers DROP CONSTRAINT IF EXISTS bank_transfers_distinct_accounts;
ALTER TABLE bank_transfers
  ADD CONSTRAINT bank_transfers_distinct_accounts
  CHECK ("fromAccountId" <> "toAccountId");

ALTER TABLE bank_transfers DROP CONSTRAINT IF EXISTS bank_transfers_positive;
ALTER TABLE bank_transfers
  ADD CONSTRAINT bank_transfers_positive
  CHECK (amount > 0);


-- A deposit line is either a customer payment being banked, or money from
-- somewhere else. Never both, never neither.
ALTER TABLE deposit_lines DROP CONSTRAINT IF EXISTS deposit_lines_one_source;
ALTER TABLE deposit_lines
  ADD CONSTRAINT deposit_lines_one_source
  CHECK (("customerPaymentId" IS NULL) <> ("accountId" IS NULL));

ALTER TABLE deposit_lines DROP CONSTRAINT IF EXISTS deposit_lines_positive;
ALTER TABLE deposit_lines
  ADD CONSTRAINT deposit_lines_positive
  CHECK (amount > 0);


-- A posted deposit's total agrees with its own lines.
CREATE OR REPLACE FUNCTION assert_deposit_total() RETURNS trigger AS $$
DECLARE
  v_lines numeric(19,4);
  v_count integer;
BEGIN
  IF NEW.status = 'VOID' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO v_lines, v_count
    FROM deposit_lines WHERE "depositId" = NEW.id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Deposit % has no lines.', NEW.number USING ERRCODE = 'check_violation';
  END IF;

  IF abs(v_lines - NEW.total) > 0.0001 THEN
    RAISE EXCEPTION 'Deposit % totals % but its lines add up to %.', NEW.number, NEW.total, v_lines
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deposit_total ON deposits;
CREATE CONSTRAINT TRIGGER trg_deposit_total
  AFTER INSERT OR UPDATE ON deposits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_deposit_total();


-- A completed reconciliation is immutable, and so are its entries.
--
-- The same principle as the ledger itself: last month's reconciliation is a
-- statement about the past. Undoing one is a deliberate act that deletes it
-- outright and says so in the audit log, not an edit that quietly changes what it
-- used to say.
CREATE OR REPLACE FUNCTION forbid_completed_reconciliation_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Deleting a completed reconciliation is how "undo" works, and is allowed.
    RETURN OLD;
  END IF;

  IF OLD.status = 'COMPLETED' AND NEW.status = 'COMPLETED' THEN
    IF (to_jsonb(NEW) - 'notes') <> (to_jsonb(OLD) - 'notes') THEN
      RAISE EXCEPTION
        'Reconciliation of % is complete and cannot be changed. Undo it instead.', OLD."statementDate"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reconciliation_immutable ON bank_reconciliations;
CREATE TRIGGER trg_reconciliation_immutable
  BEFORE UPDATE OR DELETE ON bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION forbid_completed_reconciliation_change();


-- Nothing may be added to or removed from a completed reconciliation.
CREATE OR REPLACE FUNCTION forbid_completed_entry_change() RETURNS trigger AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_company_wipe', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT status::text INTO v_status
    FROM bank_reconciliations
   WHERE id = COALESCE(NEW."reconciliationId", OLD."reconciliationId");

  -- The reconciliation is being deleted in this same transaction (an undo).
  IF v_status IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_status = 'COMPLETED' THEN
    RAISE EXCEPTION
      'That reconciliation is complete. Undo it before changing which items are cleared.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reconciliation_entry_locked ON reconciliation_entries;
CREATE TRIGGER trg_reconciliation_entry_locked
  BEFORE INSERT OR UPDATE OR DELETE ON reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_completed_entry_change();


-- A reconciliation entry names a line on the account being reconciled.
--
-- Clearing a line from a different account would let a reconciliation "balance"
-- against money that was never in that account.
CREATE OR REPLACE FUNCTION assert_entry_account_matches() RETURNS trigger AS $$
DECLARE
  v_recon_account text;
  v_line_account  text;
BEGIN
  SELECT "accountId" INTO v_recon_account
    FROM bank_reconciliations WHERE id = NEW."reconciliationId";
  SELECT "accountId" INTO v_line_account
    FROM journal_lines WHERE id = NEW."journalLineId";

  IF v_recon_account IS DISTINCT FROM v_line_account THEN
    RAISE EXCEPTION
      'That entry is on a different account from the one being reconciled.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entry_account_matches ON reconciliation_entries;
CREATE TRIGGER trg_entry_account_matches
  BEFORE INSERT OR UPDATE ON reconciliation_entries
  FOR EACH ROW EXECUTE FUNCTION assert_entry_account_matches();


-- One reconciliation in progress per account at a time.
DROP INDEX IF EXISTS reconciliations_one_in_progress;
CREATE UNIQUE INDEX reconciliations_one_in_progress
  ON bank_reconciliations ("accountId") WHERE status = 'IN_PROGRESS';
