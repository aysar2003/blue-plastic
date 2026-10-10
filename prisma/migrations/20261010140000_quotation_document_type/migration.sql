-- Estimates and quotations are separate sales document families (own lists,
-- forms, and number series). Both remain non-posting proposals.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'QUOTATION';
ALTER TYPE "SalesDocumentType" ADD VALUE IF NOT EXISTS 'QUOTATION';

-- Give every existing organisation a QUO- sequence (idempotent).
INSERT INTO document_sequences (id, "orgId", "docType", prefix, "nextNumber", padding, "createdAt", "updatedAt")
SELECT
  concat('quo_', replace(gen_random_uuid()::text, '-', '')),
  o.id,
  'QUOTATION'::"DocumentType",
  'QUO-',
  1,
  5,
  now(),
  now()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM document_sequences s
  WHERE s."orgId" = o.id
    AND s."docType" = 'QUOTATION'::"DocumentType"
);
