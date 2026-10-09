-- Each POS register gets a BANK sub-account under a POS Banks heading.
-- Idempotent: a second run finds the heading and the existing links and writes nothing new.

ALTER TABLE "pos_registers" ADD COLUMN IF NOT EXISTS "ledgerAccountId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "pos_registers_ledgerAccountId_key" ON "pos_registers"("ledgerAccountId");

DO $$ BEGIN
  ALTER TABLE "pos_registers"
    ADD CONSTRAINT "pos_registers_ledgerAccountId_fkey"
    FOREIGN KEY ("ledgerAccountId") REFERENCES "ledger_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS ledger_accounts_one_pos_banks;
CREATE UNIQUE INDEX ledger_accounts_one_pos_banks
  ON ledger_accounts ("orgId")
  WHERE "detailType" = 'POS Banks';

DROP INDEX IF EXISTS ledger_accounts_one_pos_register;
CREATE UNIQUE INDEX ledger_accounts_one_pos_register
  ON ledger_accounts ("orgId", description)
  WHERE "detailType" = 'POS register';

DO $$
DECLARE
  v_org_id text;
  v_parent_id text;
  v_parent_code text;
  v_parent_num integer;
  v_next integer;
  v_reg record;
  v_account_id text;
BEGIN
  FOR v_org_id IN
    SELECT DISTINCT "orgId" FROM pos_registers
  LOOP
    SELECT id, code INTO v_parent_id, v_parent_code
      FROM ledger_accounts
     WHERE "orgId" = v_org_id
       AND "detailType" = 'POS Banks'
     ORDER BY code
     LIMIT 1;

    IF v_parent_id IS NULL THEN
      v_parent_num := 1020;
      WHILE EXISTS (
        SELECT 1 FROM ledger_accounts
         WHERE "orgId" = v_org_id AND code = v_parent_num::text
      ) LOOP
        v_parent_num := v_parent_num + 1;
        IF v_parent_num > 1999 THEN
          RAISE EXCEPTION 'No free asset account number for POS Banks (org %)', v_org_id;
        END IF;
      END LOOP;

      v_parent_id := gen_random_uuid()::text;
      v_parent_code := v_parent_num::text;
      INSERT INTO ledger_accounts (
        id, "orgId", code, name, description, type, subtype,
        "isSystem", "isActive", "detailType", "createdAt", "updatedAt"
      ) VALUES (
        v_parent_id,
        v_org_id,
        v_parent_code,
        'POS Banks',
        'Heading for each POS register bank account. Post to a register sub-account, not here.',
        'ASSET',
        'BANK',
        false,
        true,
        'POS Banks',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    END IF;

    IF v_parent_code ~ '^[0-9]+$' THEN
      v_parent_num := v_parent_code::integer;
    ELSE
      v_parent_num := 1020;
    END IF;

    FOR v_reg IN
      SELECT id, name
        FROM pos_registers
       WHERE "orgId" = v_org_id
         AND "ledgerAccountId" IS NULL
       ORDER BY name, id
    LOOP
      SELECT id INTO v_account_id
        FROM ledger_accounts
       WHERE "orgId" = v_org_id
         AND description = 'POS register ' || v_reg.id
       LIMIT 1;

      IF v_account_id IS NULL THEN
        v_next := v_parent_num + 1;
        WHILE EXISTS (
          SELECT 1 FROM ledger_accounts
           WHERE "orgId" = v_org_id AND code = v_next::text
        ) LOOP
          v_next := v_next + 1;
          IF v_next > 1999 THEN
            RAISE EXCEPTION 'No free asset account number for POS register %', v_reg.id;
          END IF;
        END LOOP;

        v_account_id := gen_random_uuid()::text;
        INSERT INTO ledger_accounts (
          id, "orgId", code, name, description, type, subtype, "parentId",
          "isSystem", "isActive", "detailType", "createdAt", "updatedAt"
        ) VALUES (
          v_account_id,
          v_org_id,
          v_next::text,
          v_reg.name,
          'POS register ' || v_reg.id,
          'ASSET',
          'BANK',
          v_parent_id,
          false,
          true,
          'POS register',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        );
      ELSE
        UPDATE ledger_accounts
           SET "parentId" = COALESCE("parentId", v_parent_id),
               "detailType" = 'POS register',
               name = v_reg.name,
               "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = v_account_id;
      END IF;

      UPDATE pos_registers
         SET "ledgerAccountId" = v_account_id,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = v_reg.id
         AND "ledgerAccountId" IS NULL;
    END LOOP;
  END LOOP;
END $$;
