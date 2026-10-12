-- Move every cost-of-goods-sold account off Expenses, and point products at the
-- system Cost of Goods Sold account. The functions match prisma/sql/; db:harden
-- re-applies those files after this migration.

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
    IF v_type <> 'REVENUE' THEN
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

  IF NEW.type = 'INVENTORY' THEN
    IF NEW."incomeAccountId" IS NULL OR NEW."inventoryAccountId" IS NULL OR NEW."cogsAccountId" IS NULL THEN
      RAISE EXCEPTION
        'A tracked inventory item needs an income account, an inventory account and a cost of goods sold account.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Parents first, then their sub-accounts. A parent that is not cost of goods
-- sold is detached in the same update, because a sub-account must share its
-- parent's type.
DO $$
DECLARE
  n int := 1;
BEGIN
  WHILE n > 0 LOOP
    UPDATE ledger_accounts AS a
       SET type = 'COGS'::"AccountType",
           "parentId" = CASE
             WHEN a."parentId" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM ledger_accounts p
                 WHERE p.id = a."parentId"
                   AND p.subtype = 'COST_OF_GOODS_SOLD'
              )
             THEN NULL
             ELSE a."parentId"
           END
     WHERE a.subtype = 'COST_OF_GOODS_SOLD'
       AND a.type::text <> 'COGS'
       AND (
         a."parentId" IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM ledger_accounts p
            WHERE p.id = a."parentId"
              AND p.subtype = 'COST_OF_GOODS_SOLD'
         )
         OR EXISTS (
           SELECT 1 FROM ledger_accounts p
            WHERE p.id = a."parentId"
              AND p.type::text = 'COGS'
         )
       );
    GET DIAGNOSTICS n = ROW_COUNT;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ledger_accounts
     WHERE subtype = 'COST_OF_GOODS_SOLD' AND type::text <> 'COGS'
  ) THEN
    RAISE EXCEPTION 'Some cost of goods sold accounts could not be reclassified.';
  END IF;
END $$;

UPDATE items AS i
   SET "cogsAccountId" = a.id,
       "expenseAccountId" = NULL
  FROM ledger_accounts AS a
 WHERE a."orgId" = i."orgId"
   AND a."systemKey" = 'COGS'
   AND i.type = 'INVENTORY'
   AND i."incomeAccountId" IS NOT NULL
   AND i."inventoryAccountId" IS NOT NULL;

UPDATE items AS i
   SET "expenseAccountId" = a.id,
       "cogsAccountId" = NULL
  FROM ledger_accounts AS a
 WHERE a."orgId" = i."orgId"
   AND a."systemKey" = 'COGS'
   AND i.type = 'NON_INVENTORY';
