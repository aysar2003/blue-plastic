-- ---------------------------------------------------------------------------
-- Period close and year-end integrity  (Phase 9)
--
-- R5/R6 already stop a posting entering a closed period; those live in
-- ledger-integrity.sql. What follows protects the *close itself*: the record of
-- which journal closed which year, and the consistency of a year's own state.
-- ---------------------------------------------------------------------------


-- R9 -- A year's closing journal belongs to the same organisation.
--
-- Without this the closingJournalId is an ordinary foreign key that would happily
-- point at another tenant's journal, and reopening the year would reverse it.
ALTER TABLE fiscal_years DROP CONSTRAINT IF EXISTS fiscal_years_closing_journal_org_fkey;
ALTER TABLE fiscal_years
  ADD CONSTRAINT fiscal_years_closing_journal_org_fkey
  FOREIGN KEY ("closingJournalId", "orgId") REFERENCES journals (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- A journal that says it is a closing entry is sourced as one, or reverses one.
--
-- The flag and the source type are two records of the same fact, and the reports
-- read one while the year-end reads the other. Letting them disagree would mean
-- a closing entry invisible to the adjusting-entries report, or an ordinary
-- journal counted as a year-end.
--
-- REVERSAL is allowed because reopening a year reverses its closing entry, and
-- that reversal has to carry the flag: the profit and loss leaves closing entries
-- out, and if it left out the sweep but counted the sweep coming back, a reopened
-- year would report double its income.
ALTER TABLE journals DROP CONSTRAINT IF EXISTS journals_closing_entry_source;
ALTER TABLE journals
  ADD CONSTRAINT journals_closing_entry_source
  CHECK ("isClosingEntry" = false OR "sourceType" IN ('CLOSING_ENTRY', 'REVERSAL'));


-- An open year carries no record of having been closed.
--
-- Reopening clears the closing journal and the timestamp together. If either
-- could survive, a second close would either be refused for a year that is open
-- or would orphan the first closing entry.
ALTER TABLE fiscal_years DROP CONSTRAINT IF EXISTS fiscal_years_close_record;
ALTER TABLE fiscal_years
  ADD CONSTRAINT fiscal_years_close_record
  CHECK (
    (status = 'LOCKED' AND "closedAt" IS NOT NULL)
    OR (status <> 'LOCKED' AND "closedAt" IS NULL AND "closingJournalId" IS NULL)
  );


-- A locked year has no period still accepting postings.
--
-- The year-end locks every period in the same transaction as the closing entry.
-- This refuses the state where that half-happened — a locked year with an open
-- month is an invitation to post into a year whose profit has already been swept
-- to Retained Earnings, and no report would show the discrepancy.
CREATE OR REPLACE FUNCTION assert_locked_year_has_no_open_period() RETURNS trigger AS $$
DECLARE
  v_open    integer;
  v_year_id text;
BEGIN
  -- One function, two tables. Read the year id through jsonb rather than by
  -- field name, because a period names its year and a year names itself.
  IF TG_TABLE_NAME = 'fiscal_years' THEN
    v_year_id := to_jsonb(NEW) ->> 'id';
  ELSE
    v_year_id := to_jsonb(NEW) ->> 'fiscalYearId';
  END IF;

  SELECT COUNT(*) INTO v_open
    FROM accounting_periods p
    JOIN fiscal_years y ON y.id = p."fiscalYearId"
   WHERE y.status = 'LOCKED'
     AND p.status <> 'LOCKED'
     AND y.id = v_year_id;

  IF v_open > 0 THEN
    RAISE EXCEPTION
      'A closed fiscal year cannot contain a period that still accepts postings.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_locked_year_periods ON accounting_periods;
CREATE CONSTRAINT TRIGGER trg_locked_year_periods
  AFTER INSERT OR UPDATE ON accounting_periods
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_locked_year_has_no_open_period();

DROP TRIGGER IF EXISTS trg_locked_year_self ON fiscal_years;
CREATE CONSTRAINT TRIGGER trg_locked_year_self
  AFTER INSERT OR UPDATE ON fiscal_years
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_locked_year_has_no_open_period();
