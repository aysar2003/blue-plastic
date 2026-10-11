-- A sales order is a non-posting document. The customer collects later, and
-- the order then becomes either an invoice or a sales receipt.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SALES_ORDER';
ALTER TYPE "SalesDocumentType" ADD VALUE IF NOT EXISTS 'SALES_ORDER';

-- Give every existing organisation an SO- sequence (idempotent).
INSERT INTO document_sequences (id, "orgId", "docType", prefix, "nextNumber", padding, "createdAt", "updatedAt")
SELECT
  concat('so_', replace(gen_random_uuid()::text, '-', '')),
  o.id,
  'SALES_ORDER'::"DocumentType",
  'SO-',
  1,
  5,
  now(),
  now()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM document_sequences s
  WHERE s."orgId" = o.id
    AND s."docType" = 'SALES_ORDER'::"DocumentType"
);
