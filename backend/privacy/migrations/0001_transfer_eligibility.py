"""Minimal purpose/recipient/field authorization, never personal values."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


TABLES = ("privacy_datatransferauthorization", "privacy_datatransferrevocation")

FORWARD = """
CREATE FUNCTION privacy_transfer_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Transfer facts are insert-only' USING ERRCODE='23514';
    END IF;
    IF NEW.created_by_id IS NULL THEN
        RAISE EXCEPTION 'Transfer facts require a human author' USING ERRCODE='23514';
    END IF;
    IF TG_TABLE_NAME='privacy_datatransferauthorization' THEN
        IF NOT EXISTS(SELECT 1 FROM organizations_center c
            WHERE c.id=NEW.center_id AND c.organization_id=NEW.organization_id)
          OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM geography_quadrant q WHERE q.id=NEW.quadrant_id
              AND q.organization_id=NEW.organization_id AND q.center_id=NEW.center_id))
          OR length(btrim(NEW.reference))=0 OR length(btrim(NEW.recipient_institution))=0
        THEN RAISE EXCEPTION 'Transfer authorization parent invalid' USING ERRCODE='23514'; END IF;
    ELSE
        IF NOT EXISTS(SELECT 1 FROM privacy_datatransferauthorization a
            WHERE a.id=NEW.authorization_id AND a.organization_id=NEW.organization_id)
          OR length(NEW.reason)>1000 OR length(regexp_replace(NEW.reason, '[[:space:]]', '', 'g'))<10
        THEN RAISE EXCEPTION 'Transfer withdrawal parent/reason invalid' USING ERRCODE='23514'; END IF;
    END IF;
    RETURN NEW;
END; $$;
""" + "\n".join(
    f"CREATE TRIGGER {table}_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} "
    "FOR EACH ROW EXECUTE FUNCTION privacy_transfer_fact_guard();"
    for table in TABLES
)

REVERSE = "\n".join(
    f"DROP TRIGGER {table}_guard ON {table};" for table in reversed(TABLES)
) + "\nDROP FUNCTION privacy_transfer_fact_guard();"


def protect_reverse(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for table in TABLES:
            cursor.execute(f'SELECT EXISTS(SELECT 1 FROM "{table}")')
            if cursor.fetchone()[0]:
                raise IrreversibleError("Retain authored data transfer authorization/withdrawal audit.")


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0005_explicit_scope_and_revision_guard"),
        ("geography", "0003_thirdpartyintervention_thirdpartyinterventionblock_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="DataTransferAuthorization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient_institution", models.CharField(max_length=200)),
                ("purpose", models.CharField(choices=[("uieb_shipment", "uieb_shipment")], max_length=32)),
                ("fields", models.JSONField()),
                ("valid_from", models.DateTimeField()),
                ("valid_until", models.DateTimeField()),
                ("reference", models.CharField(max_length=1000)),
                ("center", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.center")),
                ("quadrant", models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to="geography.quadrant")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.organization")),
            ],
            options={
                "abstract": False,
                "base_manager_name": "objects",
                "constraints": [
                    models.CheckConstraint(condition=models.Q(created_by__isnull=False), name="privacy_datatransferauthorization_author"),
                    models.CheckConstraint(condition=models.Q(valid_until__gt=models.F("valid_from")), name="privacy_transfer_valid_interval"),
                    models.CheckConstraint(condition=models.Q(purpose="uieb_shipment", fields=["rfc"]), name="privacy_transfer_supported_fields"),
                ],
            },
        ),
        migrations.CreateModel(
            name="DataTransferRevocation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reason", models.TextField()),
                ("authorization", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="revocation", to="privacy.datatransferauthorization")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="+", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="+", to="organizations.organization")),
            ],
            options={
                "abstract": False,
                "base_manager_name": "objects",
                "constraints": [models.CheckConstraint(condition=models.Q(created_by__isnull=False), name="privacy_datatransferrevocation_author")],
            },
        ),
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
