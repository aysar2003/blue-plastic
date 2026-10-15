-- Inventory assemblies are tracked stock (builds + sales move quantity/value).

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
$$ LANGUAGE plpgsql;
