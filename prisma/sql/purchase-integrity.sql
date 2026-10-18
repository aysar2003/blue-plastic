-- ---------------------------------------------------------------------------
-- Purchase integrity  (Phase 5)
--
-- The mirror of prisma/sql/sales-integrity.sql. Deliberately the same rules with
-- the same wording: two subledgers that behave differently is a source of bugs
-- and of arguments.
-- ---------------------------------------------------------------------------


-- R9 -- Purchase documents and payments cannot cross organisations.
ALTER TABLE purchase_document_lines
  DROP CONSTRAINT IF EXISTS purchase_lines_document_org_fkey;
ALTER TABLE purchase_document_lines
  ADD CONSTRAINT purchase_lines_document_org_fkey
  FOREIGN KEY ("documentId", "orgId") REFERENCES purchase_documents (id, "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE purchase_applications
  DROP CONSTRAINT IF EXISTS purchase_applications_bill_org_fkey;
ALTER TABLE purchase_applications
  ADD CONSTRAINT purchase_applications_bill_org_fkey
  FOREIGN KEY ("billId", "orgId") REFERENCES purchase_documents (id, "orgId")
  ON DELETE RESTRICT ON UPDATE CASCADE;


-- An application has exactly one source: a payment, or a vendor credit.
ALTER TABLE purchase_applications
  DROP CONSTRAINT IF EXISTS purchase_applications_one_source;
ALTER TABLE purchase_applications
  ADD CONSTRAINT purchase_applications_one_source
  CHECK (("paymentId" IS NULL) <> ("creditDocumentId" IS NULL));

ALTER TABLE purchase_applications
  DROP CONSTRAINT IF EXISTS purchase_applications_positive;
ALTER TABLE purchase_applications
  ADD CONSTRAINT purchase_applications_positive
  CHECK (amount > 0);


-- Only an open bill can be settled, and never beyond its total.
CREATE OR REPLACE FUNCTION assert_purchase_application_target() RETURNS trigger AS $$
DECLARE
  v_type    text;
  v_status  text;
  v_total   numeric(19,4);
  v_applied numeric(19,4);
BEGIN
  SELECT type::text, status::text, total
    INTO v_type, v_status, v_total
    FROM purchase_documents WHERE id = NEW."billId";

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'The document being settled does not exist.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_type <> 'BILL' THEN
    RAISE EXCEPTION 'Only a bill can be settled; this is a %.', lower(replace(v_type, '_', ' '))
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_status IN ('DRAFT', 'VOID') THEN
    RAISE EXCEPTION 'A % bill cannot be settled.', lower(v_status)
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
    FROM purchase_applications
   WHERE "billId" = NEW."billId" AND id <> COALESCE(NEW.id, '');

  IF v_applied + NEW.amount > v_total + 0.0001 THEN
    RAISE EXCEPTION
      'That would settle % against a bill of %, which already has % applied.',
      NEW.amount, v_total, v_applied
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_purchase_application_target ON purchase_applications;
CREATE TRIGGER trg_purchase_application_target
  BEFORE INSERT OR UPDATE ON purchase_applications
  FOR EACH ROW EXECUTE FUNCTION assert_purchase_application_target();


-- A payment or credit cannot be applied beyond its own value.
CREATE OR REPLACE FUNCTION assert_purchase_application_source() RETURNS trigger AS $$
DECLARE
  v_available numeric(19,4);
  v_applied   numeric(19,4);
  v_label     text;
BEGIN
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT amount, 'Payment ' || number INTO v_available, v_label
      FROM bill_payments WHERE id = NEW."paymentId";
    SELECT COALESCE(SUM(amount), 0) INTO v_applied
      FROM purchase_applications
     WHERE "paymentId" = NEW."paymentId" AND id <> COALESCE(NEW.id, '');
  ELSE
    SELECT total, 'Vendor credit ' || number INTO v_available, v_label
      FROM purchase_documents WHERE id = NEW."creditDocumentId";
    SELECT COALESCE(SUM(amount), 0) INTO v_applied
      FROM purchase_applications
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

DROP TRIGGER IF EXISTS trg_purchase_application_source ON purchase_applications;
CREATE TRIGGER trg_purchase_application_source
  BEFORE INSERT OR UPDATE ON purchase_applications
  FOR EACH ROW EXECUTE FUNCTION assert_purchase_application_source();


-- A posted document's totals agree with its own lines.
CREATE OR REPLACE FUNCTION assert_purchase_totals() RETURNS trigger AS $$
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
    FROM purchase_document_lines WHERE "documentId" = NEW.id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Document % has no lines.', NEW.number USING ERRCODE = 'check_violation';
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

  IF abs((NEW.subtotal + NEW."taxTotal") - NEW.total) > 0.0001 THEN
    RAISE EXCEPTION
      'Document % does not add up: % plus % tax is not %.',
      NEW.number, NEW.subtotal, NEW."taxTotal", NEW.total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path TO public;

DROP TRIGGER IF EXISTS trg_purchase_totals ON purchase_documents;
CREATE CONSTRAINT TRIGGER trg_purchase_totals
  AFTER INSERT OR UPDATE ON purchase_documents
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_purchase_totals();


-- An expense is paid at once: from a money account, or by reducing a customer's balance.
ALTER TABLE purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_payment_required;
ALTER TABLE purchase_documents
  ADD CONSTRAINT purchase_documents_payment_required
  CHECK (
    type <> 'EXPENSE'
    OR status = 'DRAFT'
    OR "paymentAccountId" IS NOT NULL
    OR "offsetCustomerId" IS NOT NULL
  );


-- Totals are never negative. A negative bill is a vendor credit.
ALTER TABLE purchase_documents
  DROP CONSTRAINT IF EXISTS purchase_documents_non_negative;
ALTER TABLE purchase_documents
  ADD CONSTRAINT purchase_documents_non_negative
  CHECK (total >= 0 AND subtotal >= 0 AND "taxTotal" >= 0);

ALTER TABLE bill_payments
  DROP CONSTRAINT IF EXISTS bill_payments_positive;
ALTER TABLE bill_payments
  ADD CONSTRAINT bill_payments_positive
  CHECK (amount > 0);
