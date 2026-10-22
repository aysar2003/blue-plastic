-- Work / job section on sales documents (quotations & estimates for project parts).
ALTER TABLE "sales_documents"
  ADD COLUMN IF NOT EXISTS "workScope" TEXT;
