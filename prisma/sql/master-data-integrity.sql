-- ---------------------------------------------------------------------------
-- Master data integrity  (Phase 3)
--
-- Same principle as the ledger rules: the services check first because they can
-- explain themselves, and the database checks last because it is the guarantee.
-- Applied by a migration; re-asserted by `pnpm db:verify`.
-- ---------------------------------------------------------------------------


-- R9 (continued) -- Subledger dimensions cannot cross organisations.
--
-- Phase 2 created journal_lines."customerId" / "vendorId" without foreign keys,
-- because the tables did not exist yet. They do now. As with the journal and
-- account references, these carry "orgId" into the key so a line can never point
-- at another organisation's customer or vendor.
ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_customer_org_fkey;
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_customer_org_fkey
  FOREIGN KEY ("customerId", "orgId") REFERENCES customers (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE journal_lines
  DROP CONSTRAINT IF EXISTS journal_lines_vendor_org_fkey;
ALTER TABLE journal_lines
  ADD CONSTRAINT journal_lines_vendor_org_fkey
  FOREIGN KEY ("vendorId", "orgId") REFERENCES vendors (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- An item must map to the accounts its type actually needs, and each mapping must
-- point at an account of the right kind.
--
-- Posting is driven by these mappings. An inventory item with no COGS account
-- would sell at full margin; one whose "income" account is an expense would
-- invert the profit and loss. Neither should be expressible.
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

DROP TRIGGER IF EXISTS trg_item_account_mapping ON items;
CREATE TRIGGER trg_item_account_mapping
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION assert_item_account_mapping();


-- A tax rate is a fraction between 0 and 1, not a percentage.
--
-- Storing 15 where 0.15 was meant is the single most likely tax bug there is, and
-- it produces invoices that are wrong by a factor of a hundred.
ALTER TABLE tax_rates
  DROP CONSTRAINT IF EXISTS tax_rates_fraction;
ALTER TABLE tax_rates
  ADD CONSTRAINT tax_rates_fraction
  CHECK (rate >= 0 AND rate <= 1);


-- Exactly one default payment term per organisation.
DROP INDEX IF EXISTS payment_terms_one_default;
CREATE UNIQUE INDEX payment_terms_one_default
  ON payment_terms ("orgId") WHERE "isDefault";
