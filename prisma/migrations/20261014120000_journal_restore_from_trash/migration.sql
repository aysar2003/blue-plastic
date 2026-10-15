-- Trash restore: allow DELETED → POSTED|REVERSED when the deletion stamp clears
-- and nothing else about the journal row changes. See prisma/sql/ledger-integrity.sql.

CREATE OR REPLACE FUNCTION forbid_posted_journal_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_company_wipe', true) = 'on' THEN
      RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION
        'Journal % is posted and cannot be deleted. Post a reversal instead.', OLD."journalNumber"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.status = 'DELETED' AND OLD.status IN ('POSTED', 'REVERSED') THEN
    IF NEW."deletedAt" IS NULL THEN
      RAISE EXCEPTION
        'Journal % cannot be marked deleted without recording when.', OLD."journalNumber"
        USING ERRCODE = 'check_violation';
    END IF;

    IF (to_jsonb(NEW) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
       = (to_jsonb(OLD) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Journal % cannot be changed while it is being deleted.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'DELETED' AND NEW.status IN ('POSTED', 'REVERSED') THEN
    IF NEW."deletedAt" IS NOT NULL THEN
      RAISE EXCEPTION
        'Journal % cannot be restored without clearing the deletion stamp.', OLD."journalNumber"
        USING ERRCODE = 'check_violation';
    END IF;

    IF (to_jsonb(NEW) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
       = (to_jsonb(OLD) - 'status' - 'updatedAt' - 'deletedAt' - 'deletedById' - 'deleteReason')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Journal % cannot be changed while it is being restored.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'DELETED' THEN
    RAISE EXCEPTION
      'Journal % has been deleted and cannot be changed.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'REVERSED' THEN
    RAISE EXCEPTION
      'Journal % has already been reversed and cannot be changed.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'POSTED' THEN
    IF NEW.status = 'REVERSED'
       AND (to_jsonb(NEW) - 'status' - 'updatedAt') = (to_jsonb(OLD) - 'status' - 'updatedAt')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Journal % is posted and immutable.', OLD."journalNumber"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
