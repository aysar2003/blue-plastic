-- Allow Settings → Default accounts to rebind a system role when the session
-- sets app.allow_system_rebind = on (see system-accounts.service assign).
CREATE OR REPLACE FUNCTION protect_system_accounts() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_company_wipe', true) = 'on' THEN
      RETURN OLD;
    END IF;
    IF OLD."isSystem" THEN
      RAISE EXCEPTION
        'Account % (%) is a system account and cannot be deleted. Rename it if the wording does not suit you.',
        OLD.code, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."systemKey" IS DISTINCT FROM NEW."systemKey" THEN
    IF current_setting('app.allow_system_rebind', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION
        'The system role of account % (%) cannot be changed.', OLD.code, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD."isSystem" AND NOT NEW."isActive" THEN
    RAISE EXCEPTION
      'Account % (%) is a system account and cannot be archived.', OLD.code, OLD.name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO public;
