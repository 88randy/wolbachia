"""Protect tenant-coherent personnel state and append-only disclosure receipts."""

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = r"""
CREATE FUNCTION accounts_personnel_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Personnel records cannot be deleted' USING ERRCODE='23514';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.revision <> 1 THEN
        RAISE EXCEPTION 'Personnel initial revision mismatch' USING ERRCODE='23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (
        ROW(NEW.id, NEW.organization_id, NEW.membership_id, NEW.created_by_id, NEW.created_at)
          IS DISTINCT FROM
        ROW(OLD.id, OLD.organization_id, OLD.membership_id, OLD.created_by_id, OLD.created_at)
        OR NEW.revision <> OLD.revision + 1
    ) THEN
        RAISE EXCEPTION 'Personnel identity or revision mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE id=NEW.membership_id AND organization_id=NEW.organization_id
    ) OR NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE user_id=NEW.created_by_id AND organization_id=NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Personnel membership tenant mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_center
        WHERE id=NEW.center_id AND organization_id=NEW.organization_id
    ) OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM geography_quadrant
        WHERE id=NEW.quadrant_id AND organization_id=NEW.organization_id
          AND center_id=NEW.center_id
    )) THEN
        RAISE EXCEPTION 'Personnel context mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT (
        (octet_length(NEW.rfc_ciphertext)=0 AND octet_length(NEW.rfc_nonce)=0
          AND octet_length(NEW.rfc_wrapped_key)=0 AND NEW.rfc_key_version=''
          AND NEW.rfc_fingerprint='')
        OR
        (octet_length(NEW.rfc_ciphertext)>=16 AND octet_length(NEW.rfc_nonce)=12
          AND octet_length(NEW.rfc_wrapped_key)>0 AND btrim(NEW.rfc_key_version)<>''
          AND NEW.rfc_fingerprint ~ '^[0-9a-f]{64}$')
    ) THEN
        RAISE EXCEPTION 'Personnel RFC envelope incomplete' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER accounts_personnel_guard
BEFORE INSERT OR UPDATE OR DELETE ON accounts_personnel
FOR EACH ROW EXECUTE FUNCTION accounts_personnel_guard();

CREATE FUNCTION accounts_accesslog_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target accounts_personnel;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Access receipts are insert only' USING ERRCODE='23514';
    END IF;
    IF NEW.action NOT IN ('user.create','user.update','user.deactivate',
        'user.reveal_rfc','user.rotate_rfc')
      OR NEW.origin NOT IN ('web','device','internal') OR NEW.result <> 'success'
    THEN
        RAISE EXCEPTION 'Access receipt vocabulary mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE user_id=NEW.created_by_id AND organization_id=NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Access receipt actor tenant mismatch' USING ERRCODE='23514';
    END IF;
    SELECT * INTO target FROM accounts_personnel WHERE id=NEW.target_id FOR SHARE;
    IF target.id IS NULL OR target.organization_id IS DISTINCT FROM NEW.organization_id
      OR target.center_id IS DISTINCT FROM NEW.center_id
      OR target.quadrant_id IS DISTINCT FROM NEW.quadrant_id
      OR target.revision IS DISTINCT FROM NEW.revision
      OR NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE id=target.membership_id AND organization_id=NEW.organization_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM organizations_center
        WHERE id=NEW.center_id AND organization_id=NEW.organization_id
      )
      OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM geography_quadrant
        WHERE id=NEW.quadrant_id AND organization_id=NEW.organization_id
          AND center_id=NEW.center_id
      ))
    THEN
        RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER accounts_accesslog_guard
BEFORE INSERT OR UPDATE OR DELETE ON accounts_accesslog
FOR EACH ROW EXECUTE FUNCTION accounts_accesslog_guard();
"""

REVERSE_SQL = """
DROP TRIGGER accounts_accesslog_guard ON accounts_accesslog;
DROP FUNCTION accounts_accesslog_guard();
DROP TRIGGER accounts_personnel_guard ON accounts_personnel;
DROP FUNCTION accounts_personnel_guard();
"""


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    alias = schema_editor.connection.alias
    if (
        apps.get_model("accounts", "Personnel").objects.using(alias).exists()
        or apps.get_model("accounts", "AccessLog").objects.using(alias).exists()
    ):
        raise IrreversibleError("Retain personnel state and access receipts.")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_personnel_accesslog_and_more")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
