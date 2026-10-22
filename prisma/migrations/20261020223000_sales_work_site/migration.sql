-- Work site on sales documents (where the job is done). Printed below Sales person.
ALTER TABLE "sales_documents"
  ADD COLUMN IF NOT EXISTS "workSite" TEXT;
