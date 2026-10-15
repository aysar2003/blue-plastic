-- Pending / draft states for bank-style documents (transfers, deposits, stock adjustments).

ALTER TYPE "BankDocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "BankDocumentStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
