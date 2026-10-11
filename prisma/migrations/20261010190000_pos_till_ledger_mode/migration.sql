-- How POS till money appears on the chart of accounts.
CREATE TYPE "PosTillLedgerMode" AS ENUM ('HOLD_OFF_CHART', 'REGISTER_IN_CHART');

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "posTillLedgerMode" "PosTillLedgerMode" NOT NULL DEFAULT 'REGISTER_IN_CHART';
