-- Discount items may post to contra-income (REVENUE / SALES_DISCOUNTS) or to a
-- dedicated expense account the business prepared for discounts.
CREATE OR REPLACE FUNCTION assert_item_account_mapping() RETURNS trigger AS $$
DECLARE
  v_type text;
BEGIN
  IF NEW."incomeAccountId" IS NOT NULL THEN
    SELECT type::text INTO v_type FROM ledger_accounts
      WHERE id = NEW."incomeAccountId" AND "orgId" = NEW."orgId";
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'The income account does not belong to this organisation.'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF NEW.type = 'DISCOUNT' THEN
      IF v_type NOT IN ('REVENUE', 'EXPENSE') THEN
        RAISE EXCEPTION 'A discount account must be an income or expense account, not %.', lower(v_type)
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF v_type <> 'REVENUE' THEN
      RAISE EXCEPTION 'An item''s income account must be an income account, not %.', lower(v_type)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."expenseAccountId" IS NOT NULL THEN
    SELECT type::text INTO v_type FROM ledger_accounts
      WHERE id = NEW."expenseAccountId" AND "orgId" = NEW."orgId";
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'The expense account does not belong to this organisation.'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF v_type NOT IN ('EXPENSE', 'COGS') THEN
      RAISE EXCEPTION 'An item''s expense account must be an expense or cost of goods sold account, not %.', lower(v_type)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."cogsAccountId" IS NOT NULL THEN
    SELECT type::text INTO v_type FROM ledger_accounts
      WHERE id = NEW."cogsAccountId" AND "orgId" = NEW."orgId";
    IF v_type IS DISTINCT FROM 'COGS' THEN
      RAISE EXCEPTION 'The cost of goods sold account must be a cost of goods sold account.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."inventoryAccountId" IS NOT NULL THEN
    SELECT subtype::text INTO v_type FROM ledger_accounts
      WHERE id = NEW."inventoryAccountId" AND "orgId" = NEW."orgId";
    IF v_type IS DISTINCT FROM 'INVENTORY' THEN
      RAISE EXCEPTION 'The inventory account must be an account of the inventory type.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- A tracked item that cannot value its stock or its cost of sale is not a
  -- tracked item. Assemblies follow the same account rules as inventory parts.
  IF NEW.type IN ('INVENTORY', 'INVENTORY_ASSEMBLY') THEN
    IF NEW."incomeAccountId" IS NULL OR NEW."inventoryAccountId" IS NULL OR NEW."cogsAccountId" IS NULL THEN
      RAISE EXCEPTION
        'A tracked inventory item needs an income account, an inventory account and a cost of goods sold account.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
