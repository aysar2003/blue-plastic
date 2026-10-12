-- Cost of goods sold is its own statement type, not an expense.
-- The new value is committed in this migration alone. PostgreSQL cannot use a
-- value added to an enum in the same transaction that adds it.

ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'COGS' BEFORE 'EXPENSE';
