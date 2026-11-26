"""A distinct receipt for an issued temporary password (never recorded as a plain update)."""

from django.apps.registry import Apps
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = r"""
CREATE OR REPLACE FUNCTION accounts_accesslog_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target accounts_personnel;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Access receipts are insert only' USING ERRCODE='23514';
    END IF;
    IF NEW.action NOT IN ('user.create','user.update','user.deactivate',
        'user.reveal_rfc','user.rotate_rfc','user.temporary_password')
      OR NEW.origin NOT IN ('web','device','internal')
      OR NEW.result NOT IN ('success','rfc_rejected')
    THEN
        RAISE EXCEPTION 'Access receipt vocabulary mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE user_id=NEW.created_by_id AND organization_id=NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Access receipt actor tenant mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_center
        WHERE id=NEW.center_id AND organization_id=NEW.organization_id
    ) OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM geography_quadrant
        WHERE id=NEW.quadrant_id AND organization_id=NEW.organization_id
          AND center_id=NEW.center_id
    )) THEN
        RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
    END IF;
    IF NEW.target_id IS NULL THEN
        IF NEW.action <> 'user.create' OR NEW.result <> 'rfc_rejected' OR NEW.revision <> 1 THEN
            RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.result = 'rfc_rejected' AND NEW.action <> 'user.update' THEN
        RAISE EXCEPTION 'Access receipt vocabulary mismatch' USING ERRCODE='23514';
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
    THEN
        RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$;
"""

# The 0006 function, restored on reverse.
REVERSE_SQL = r"""
CREATE OR REPLACE FUNCTION accounts_accesslog_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    target accounts_personnel;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Access receipts are insert only' USING ERRCODE='23514';
    END IF;
    IF NEW.action NOT IN ('user.create','user.update','user.deactivate',
        'user.reveal_rfc','user.rotate_rfc')
      OR NEW.origin NOT IN ('web','device','internal')
      OR NEW.result NOT IN ('success','rfc_rejected')
    THEN
        RAISE EXCEPTION 'Access receipt vocabulary mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_membership
        WHERE user_id=NEW.created_by_id AND organization_id=NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Access receipt actor tenant mismatch' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM organizations_center
        WHERE id=NEW.center_id AND organization_id=NEW.organization_id
    ) OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM geography_quadrant
        WHERE id=NEW.quadrant_id AND organization_id=NEW.organization_id
          AND center_id=NEW.center_id
    )) THEN
        RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
    END IF;
    IF NEW.target_id IS NULL THEN
        IF NEW.action <> 'user.create' OR NEW.result <> 'rfc_rejected' OR NEW.revision <> 1 THEN
            RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.result = 'rfc_rejected' AND NEW.action <> 'user.update' THEN
        RAISE EXCEPTION 'Access receipt vocabulary mismatch' USING ERRCODE='23514';
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
    THEN
        RAISE EXCEPTION 'Access receipt target context mismatch' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END; $$;
"""


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    receipts = apps.get_model("accounts", "AccessLog").objects.using(schema_editor.connection.alias)
    if receipts.filter(action="user.temporary_password").exists():
        raise IrreversibleError("Retain temporary password receipts.")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0007_user_must_change_password_and_more")]

    operations = [
        migrations.AlterField(
            model_name="accesslog",
            name="action",
            field=models.CharField(
                choices=[
                    ("user.create", "Create"),
                    ("user.update", "Update"),
                    ("user.deactivate", "Deactivate"),
                    ("user.reveal_rfc", "Reveal Rfc"),
                    ("user.rotate_rfc", "Rotate Rfc"),
                    ("user.temporary_password", "Temporary Password"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
