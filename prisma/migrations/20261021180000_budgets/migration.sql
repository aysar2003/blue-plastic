-- Budgets for Budget vs Actual reporting
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budgets_orgId_startDate_endDate_idx" ON "budgets"("orgId", "startDate", "endDate");
CREATE INDEX "budget_lines_orgId_budgetId_idx" ON "budget_lines"("orgId", "budgetId");
CREATE UNIQUE INDEX "budget_lines_budgetId_accountId_key" ON "budget_lines"("budgetId", "accountId");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
