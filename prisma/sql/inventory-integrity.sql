-- ---------------------------------------------------------------------------
-- Inventory integrity  (Phase 7)
-- ---------------------------------------------------------------------------


-- R9 -- Adjustment lines cannot cross organisations.
ALTER TABLE inventory_adjustment_lines DROP CONSTRAINT IF EXISTS adjustment_lines_document_org_fkey;
ALTER TABLE inventory_adjustment_lines
  ADD CONSTRAINT adjustment_lines_document_org_fkey
  FOREIGN KEY ("adjustmentId", "orgId") REFERENCES inventory_adjustments (id, "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;


-- A movement of nothing is not a movement.
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_non_zero;
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_non_zero
  CHECK (quantity <> 0 OR value <> 0);


-- The stock ledger is append-only, exactly like the general ledger.
--
-- Its running totals are the reason. Each row states the item's position after
-- that movement; editing an earlier row would make every later one a lie, and
-- silently break the equality with the Inventory Asset account that the whole
-- design rests on. Corrections are adjustments, which are themselves movements.
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

  -- One transition is permitted: attaching the movement to the journal it was
  -- posted with. The cost has to be known before the journal can be built, so
  -- the movement is necessarily written first; recording which entry carried it
  -- is not a change to the movement. Everything else about the row must be
  -- identical, and a journal that is already set cannot be swapped.
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

DROP TRIGGER IF EXISTS trg_inventory_movement_immutable ON inventory_transactions;
CREATE TRIGGER trg_inventory_movement_immutable
  BEFORE UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_inventory_movement_change();


-- Only a tracked item has a stock ledger.
--
-- A service has no quantity and no cost to carry; a movement against one would
-- put value into the Inventory Asset account that no stock corresponds to.
CREATE OR REPLACE FUNCTION assert_movement_item_tracked() RETURNS trigger AS $$
DECLARE
  v_type text;
  v_name text;
BEGIN
  SELECT type::text, name INTO v_type, v_name FROM items WHERE id = NEW."itemId";

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Stock movement references an item that does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_type <> 'INVENTORY' AND v_type <> 'INVENTORY_ASSEMBLY' THEN
    RAISE EXCEPTION
      '"%" is not a tracked inventory item, so it has no stock to move.', v_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_movement_item_tracked ON inventory_transactions;
CREATE TRIGGER trg_movement_item_tracked
  BEFORE INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION assert_movement_item_tracked();


-- The running totals must follow on from the movement before them.
--
-- This is what makes the ledger's own arithmetic checkable rather than merely
-- intended: each row is verified against its predecessor at the moment it is
-- written, so a bug in the costing engine cannot quietly accumulate.
CREATE OR REPLACE FUNCTION assert_movement_continuity() RETURNS trigger AS $$
DECLARE
  prev RECORD;
  expected_quantity numeric(19,4);
  expected_value    numeric(19,4);
BEGIN
  SELECT "runningQuantity", "runningValue", sequence
    INTO prev
    FROM inventory_transactions
   WHERE "itemId" = NEW."itemId"
   ORDER BY sequence DESC
   LIMIT 1;

  IF NOT FOUND THEN
    expected_quantity := NEW.quantity;
    expected_value    := NEW.value;
    IF NEW.sequence <> 1 THEN
      RAISE EXCEPTION 'The first movement for an item must be sequence 1, not %.', NEW.sequence
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.sequence <> prev.sequence + 1 THEN
      RAISE EXCEPTION
        'Stock movements must be consecutive: expected sequence %, got %.',
        prev.sequence + 1, NEW.sequence
        USING ERRCODE = 'check_violation';
    END IF;
    expected_quantity := prev."runningQuantity" + NEW.quantity;
    expected_value    := prev."runningValue" + NEW.value;
  END IF;

  IF abs(NEW."runningQuantity" - expected_quantity) > 0.0001 THEN
    RAISE EXCEPTION
      'Running quantity is % but the movement before it leaves %.',
      NEW."runningQuantity", expected_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  IF abs(NEW."runningValue" - expected_value) > 0.0001 THEN
    RAISE EXCEPTION
      'Running value is % but the movement before it leaves %.',
      NEW."runningValue", expected_value
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_movement_continuity ON inventory_transactions;
CREATE TRIGGER trg_movement_continuity
  BEFORE INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION assert_movement_continuity();


-- An adjustment line's arithmetic must hold.
ALTER TABLE inventory_adjustment_lines DROP CONSTRAINT IF EXISTS adjustment_lines_change;
ALTER TABLE inventory_adjustment_lines
  ADD CONSTRAINT adjustment_lines_change
  CHECK (abs("quantityChange" - ("countedQuantity" - "previousQuantity")) < 0.0001);
