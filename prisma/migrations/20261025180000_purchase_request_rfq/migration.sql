-- Internal purchase requests (PR) and vendor RFQs — non-posting steps before a PO.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PURCHASE_REQUEST';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'RFQ';
ALTER TYPE "PurchaseDocumentType" ADD VALUE IF NOT EXISTS 'PURCHASE_REQUEST';
ALTER TYPE "PurchaseDocumentType" ADD VALUE IF NOT EXISTS 'RFQ';

-- PR may have no vendor yet (internal ask). RFQ / PO / bills still require one in app code.
ALTER TABLE "purchase_documents" ALTER COLUMN "vendorId" DROP NOT NULL;

-- Give every existing organisation PR- and RFQ- sequences (idempotent).
INSERT INTO document_sequences (id, "orgId", "docType", prefix, "nextNumber", padding, "createdAt", "updatedAt")
SELECT
  concat('pr_', replace(gen_random_uuid()::text, '-', '')),
  o.id,
  'PURCHASE_REQUEST'::"DocumentType",
  'PR-',
  1,
  5,
  now(),
  now()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM document_sequences s
  WHERE s."orgId" = o.id
    AND s."docType" = 'PURCHASE_REQUEST'::"DocumentType"
);

INSERT INTO document_sequences (id, "orgId", "docType", prefix, "nextNumber", padding, "createdAt", "updatedAt")
SELECT
  concat('rfq_', replace(gen_random_uuid()::text, '-', '')),
  o.id,
  'RFQ'::"DocumentType",
  'RFQ-',
  1,
  5,
  now(),
  now()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM document_sequences s
  WHERE s."orgId" = o.id
    AND s."docType" = 'RFQ'::"DocumentType"
);
