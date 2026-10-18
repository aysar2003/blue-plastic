-- ---------------------------------------------------------------------------
-- Sales integrity  (Phase 4)
--
-- Applied by a migration, re-applied by `pnpm db:harden`, re-asserted by
-- `pnpm db:verify`.
-- ---------------------------------------------------------------------------


-- R9 (continued) -- Sales documents and payments cannot cross organisations.
ALTER TABLE sales_document_lines
  DROP CONSTRAINT IF EXISTS sales_lines_document_org_fkey;
ALTER TABLE sales_document_lines
  ADD CONSTRAINT sales_lines_document_org_fkey
  FOREIGN KEY ("documentId", "orgId") REFERENCES sales_documents (id, "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE sales_applications
  DROP CONSTRAINT IF EXISTS sales_applications_invoice_org_fkey;
ALTER TABLE sales_applications
  ADD CONSTRAINT sales_applications_invoice_org_fkey
  FOREIGN KEY ("invoiceId", "orgId") REFERENCES sales_documents (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- An application has exactly one source: a payment, or a credit memo.
--
-- Without this, a row with neither would settle an invoice out of nothing, and a
-- row with both would be counted twice by whichever query looked first.
ALTER TABLE sales_applications
  DROP CONSTRAINT IF EXISTS sales_applications_one_source;
ALTER TABLE sales_applications
  ADD CONSTRAINT sales_applications_one_source
  CHECK (("paymentId" IS NULL) <> ("creditDocumentId" IS NULL));


-- An application is a positive amount.
ALTER TABLE sales_applications
  DROP CONSTRAINT IF EXISTS sales_applications_positive;
ALTER TABLE sales_applications
  ADD CONSTRAINT sales_applications_positive
  CHECK (amount > 0);


-- Nothing may be applied to a document that is not an invoice.
--
-- Applying a payment to an estimate or to another credit memo would settle
-- something that was never a receivable.
CREATE OR REPLACE FUNCTION assert_application_target() RETURNS trigger AS $$
DECLARE
  v_type   text;
  v_status text;
  v_total  numeric(19,4);
  v_applied numeric(19,4);
BEGIN
  SELECT type::text, status::text, total
    INTO v_type, v_status, v_total
    FROM sales_documents WHERE id = NEW."invoiceId";

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'The document being settled does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_type <> 'INVOICE' THEN
    RAISE EXCEPTION 'Only an invoice can be settled; this is a %.', lower(v_type)
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_status IN ('DRAFT', 'VOID') THEN
    RAISE EXCEPTION 'A % invoice cannot be settled.', lower(v_status)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nothing may be over-applied. An invoice settled beyond its own total is a
  -- negative receivable, which is a credit note wearing a disguise.
  SELECT COALESCE(SUM(amount), 0) INTO v_applied
    FROM sales_applications
   WHERE "invoiceId" = NEW."invoiceId"
     AND id <> COALESCE(NEW.id, '');

  IF v_applied + NEW.amount > v_total + 0.0001 THEN
    RAISE EXCEPTION
      'That would settle % against an invoice of %, which already has % applied.',
      NEW.amount, v_total, v_applied
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_application_target ON sales_applications;
CREATE TRIGGER trg_application_target
  BEFORE INSERT OR UPDATE ON sales_applications
  FOR EACH ROW EXECUTE FUNCTION assert_application_target();


-- A document's stored totals must agree with its own lines.
--
-- Totals are stored because they are what the customer was shown. That makes it
-- worth proving they were never assembled wrongly: a document whose total does
-- not equal the sum of its lines would post a journal that disagrees with the
-- paper.
CREATE OR REPLACE FUNCTION assert_document_totals() RETURNS trigger AS $$
DECLARE
  v_lines_net numeric(19,4);
  v_lines_tax numeric(19,4);
  v_count     integer;
BEGIN
  IF NEW.status = 'DRAFT' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM("taxAmount"), 0), COUNT(*)
    INTO v_lines_net, v_lines_tax, v_count
    FROM sales_document_lines WHERE "documentId" = NEW.id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Document % has no lines.', NEW.number
      USING ERRCODE = 'check_violation';
  END IF;

  IF abs(v_lines_net - NEW.subtotal) > 0.0001 THEN
    RAISE EXCEPTION
      'Document % has a subtotal of % but its lines total %.', NEW.number, NEW.subtotal, v_lines_net
      USING ERRCODE = 'check_violation';
  END IF;

  IF abs(v_lines_tax - NEW."taxTotal") > 0.0001 THEN
    RAISE EXCEPTION
      'Document % has tax of % but its lines total %.', NEW.number, NEW."taxTotal", v_lines_tax
      USING ERRCODE = 'check_violation';
  END IF;

  IF abs((NEW.subtotal - NEW."discountAmount" + NEW."taxTotal") - NEW.total) > 0.0001 THEN
    RAISE EXCEPTION
      'Document % does not add up: % subtotal less % discount plus % tax is not %.',
      NEW.number, NEW.subtotal, NEW."discountAmount", NEW."taxTotal", NEW.total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_document_totals ON sales_documents;
CREATE CONSTRAINT TRIGGER trg_document_totals
  AFTER INSERT OR UPDATE ON sales_documents
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_document_totals();


-- Documents that move cash immediately must say where it went.
ALTER TABLE sales_documents
  DROP CONSTRAINT IF EXISTS sales_documents_deposit_required;
ALTER TABLE sales_documents
  ADD CONSTRAINT sales_documents_deposit_required
  CHECK (
    type NOT IN ('SALES_RECEIPT', 'REFUND_RECEIPT')
    OR status = 'DRAFT'
    OR "depositAccountId" IS NOT NULL
  );


-- Totals are never negative. A negative invoice is a credit memo.
ALTER TABLE sales_documents
  DROP CONSTRAINT IF EXISTS sales_documents_non_negative;
ALTER TABLE sales_documents
  ADD CONSTRAINT sales_documents_non_negative
  CHECK (total >= 0 AND subtotal >= 0 AND "taxTotal" >= 0 AND "discountAmount" >= 0);


-- A payment is a positive amount.
ALTER TABLE customer_payments
  DROP CONSTRAINT IF EXISTS customer_payments_positive;
ALTER TABLE customer_payments
  ADD CONSTRAINT customer_payments_positive
  CHECK (amount > 0);


-- A payment or credit cannot be applied beyond its own value.
CREATE OR REPLACE FUNCTION assert_application_source() RETURNS trigger AS $$
DECLARE
  v_available numeric(19,4);
  v_applied   numeric(19,4);
  v_label     text;
BEGIN
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT amount, 'Payment ' || number INTO v_available, v_label
      FROM customer_payments WHERE id = NEW."paymentId";
    SELECT COALESCE(SUM(amount), 0) INTO v_applied
      FROM sales_applications
     WHERE "paymentId" = NEW."paymentId" AND id <> COALESCE(NEW.id, '');
  ELSE
    SELECT total, 'Credit memo ' || number INTO v_available, v_label
      FROM sales_documents WHERE id = NEW."creditDocumentId";
    SELECT COALESCE(SUM(amount), 0) INTO v_applied
      FROM sales_applications
     WHERE "creditDocumentId" = NEW."creditDocumentId" AND id <> COALESCE(NEW.id, '');
  END IF;

  IF v_available IS NULL THEN
    RAISE EXCEPTION 'The payment or credit being applied does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_applied + NEW.amount > v_available + 0.0001 THEN
    RAISE EXCEPTION
      '% is worth % and already has % applied; % more cannot come out of it.',
      v_label, v_available, v_applied, NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_application_source ON sales_applications;
CREATE TRIGGER trg_application_source
  BEFORE INSERT OR UPDATE ON sales_applications
  FOR EACH ROW EXECUTE FUNCTION assert_application_source();
