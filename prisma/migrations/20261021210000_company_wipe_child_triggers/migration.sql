-- Company wipe also updates/deletes posted journal lines and stock movements
-- (nullable FKs that close a cycle, then leaf rows). Those triggers only allowed
-- DELETE on the journal header and on stock, so the ordered wipe failed.

CREATE OR REPLACE FUNCTION forbid_posted_line_mutation() RETURNS trigger AS $$
DECLARE
  v_status text;
BEGIN
  IF current_setting('app.allow_company_wipe', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT status::text INTO v_status
    FROM journals WHERE id = COALESCE(OLD."journalId", NEW."journalId");

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
$$ LANGUAGE plpgsql SET search_path TO public;

CREATE OR REPLACE FUNCTION forbid_inventory_movement_change() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_company_wipe', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Stock movements cannot be deleted. Record an adjustment instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."journalId" IS NULL AND NEW."journalId" IS NOT NULL
     AND (to_jsonb(NEW) - 'journalId') = (to_jsonb(OLD) - 'journalId')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Stock movements cannot be changed. Record an adjustment instead.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql SET search_path TO public;
