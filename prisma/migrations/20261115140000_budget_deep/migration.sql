-- Budget deep: status/versions, monthly lines + class, unique with COALESCE class

CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

ALTER TABLE "budgets"
  ADD COLUMN "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "supersedesId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMPTZ(6),
  ADD COLUMN "approvedById" TEXT;

CREATE INDEX "budgets_orgId_status_idx" ON "budgets"("orgId", "status");
CREATE INDEX "budgets_supersedesId_idx" ON "budgets"("supersedesId");

ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prepare budget_lines for month + class
ALTER TABLE "budget_lines" DROP CONSTRAINT IF EXISTS "budget_lines_budgetId_accountId_key";
DROP INDEX IF EXISTS "budget_lines_budgetId_accountId_key";

ALTER TABLE "budget_lines"
  ADD COLUMN "month" SMALLINT,
  ADD COLUMN "trackingCategoryId" TEXT;

-- Spread existing annual amounts evenly across months overlapping the budget window
DO $$
DECLARE
  r RECORD;
  months INT[];
  m INT;
  n INT;
  i INT;
  base NUMERIC(19,4);
  rem NUMERIC(19,4);
  amt NUMERIC(19,4);
  new_id TEXT;
BEGIN
  FOR r IN
    SELECT bl.id, bl."orgId", bl."budgetId", bl."accountId", bl.amount,
           b."startDate", b."endDate"
    FROM budget_lines bl
    JOIN budgets b ON b.id = bl."budgetId"
    WHERE bl.month IS NULL
  LOOP
    months := ARRAY[]::INT[];
    FOR m IN 0..((DATE_PART('year', r."endDate")::INT - DATE_PART('year', r."startDate")::INT) * 12
                 + DATE_PART('month', r."endDate")::INT - DATE_PART('month', r."startDate")::INT)
    LOOP
      months := months || ARRAY[
        ((DATE_PART('month', r."startDate")::INT - 1 + m) % 12) + 1
      ];
    END LOOP;

    -- Dedupe calendar months while preserving order (cap at 12 for typical FY)
    SELECT ARRAY(SELECT DISTINCT x FROM unnest(months) AS x ORDER BY x) INTO months;
    IF array_length(months, 1) IS NULL OR array_length(months, 1) = 0 THEN
      months := ARRAY[GREATEST(1, LEAST(12, DATE_PART('month', r."startDate")::INT))];
    END IF;

    n := array_length(months, 1);
    base := TRUNC(r.amount / n, 4);
    rem := r.amount - (base * n);

    DELETE FROM budget_lines WHERE id = r.id;

    FOR i IN 1..n LOOP
      amt := base;
      IF i = n THEN
        amt := base + rem;
      END IF;
      new_id := md5(random()::text || clock_timestamp()::text || i::text || r.id);
      INSERT INTO budget_lines (id, "orgId", "budgetId", "accountId", month, amount)
      VALUES (new_id, r."orgId", r."budgetId", r."accountId", months[i], amt);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "budget_lines" ALTER COLUMN "month" SET NOT NULL;

CREATE INDEX "budget_lines_budgetId_accountId_month_idx"
  ON "budget_lines"("budgetId", "accountId", "month");
CREATE INDEX "budget_lines_trackingCategoryId_idx"
  ON "budget_lines"("trackingCategoryId");

-- Unique per budget/account/month/class (NULL class = '')
CREATE UNIQUE INDEX "budget_lines_budget_account_month_class_key"
  ON "budget_lines" ("budgetId", "accountId", "month", (COALESCE("trackingCategoryId", '')));

ALTER TABLE "budget_lines"
  ADD CONSTRAINT "budget_lines_trackingCategoryId_fkey"
  FOREIGN KEY ("trackingCategoryId") REFERENCES "tracking_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
