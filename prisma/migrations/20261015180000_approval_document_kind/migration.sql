-- Narrow approval workflows to a document kind (invoice, PO, sales order, …).
-- Null documentKind keeps matching the whole family (current behaviour).

ALTER TABLE "approval_policies" ADD COLUMN "documentKind" TEXT;

CREATE INDEX "approval_policies_orgId_entityType_documentKind_idx"
  ON "approval_policies"("orgId", "entityType", "documentKind");
