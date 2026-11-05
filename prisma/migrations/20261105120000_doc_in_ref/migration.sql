-- QuickBooks-style IN/ (GRN / internal refs) beside P.O. NO. on sales and purchase docs.
ALTER TABLE "sales_documents"
  ADD COLUMN IF NOT EXISTS "inRef" TEXT;

ALTER TABLE "purchase_documents"
  ADD COLUMN IF NOT EXISTS "inRef" TEXT;
