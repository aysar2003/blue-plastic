-- Invoice paper: bank lines, terms, colour, and the hidden classic sheet.
ALTER TABLE "organizations" ADD COLUMN "documentTemplate" JSONB;

-- Printed on the merchant invoice as Sales person.
ALTER TABLE "customers" ADD COLUMN "salesPerson" TEXT;
