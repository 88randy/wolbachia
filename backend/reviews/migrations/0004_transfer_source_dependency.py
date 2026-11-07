"""One narrow, typed cross-author dispatch parent; every legacy branch stays exact."""

from importlib import import_module

from django.db import migrations

LEGACY = import_module("reviews.migrations.0002_append_only_reviews").INSERT_CHECKS[
    "reviews_reviewdependencyresolution"
]
AUTHOR_BRANCH = "(d.kind='ovitrap' OR child.created_by_id=parent.created_by_id)"
PARENT_BRANCH = "(d.kind='void_target' AND d.declared_id=parent.id)"
TRANSFER_BRANCH = """(d.kind='transfer_source' AND d.declared_id=parent.id
    AND child.type='transfer.receive' AND parent.type='transfer.dispatch'
    AND EXISTS (SELECT 1 FROM inventory_transfersourcelink link
        JOIN inventory_transferevent e ON e.id=link.event_id
        JOIN reviews_reviewsourcesnapshot captured ON captured.source_event_id=child.id
        WHERE link.source_event_id=parent.id AND link.organization_id=NEW.organization_id
        AND e.kind='dispatch' AND e.declared_source_uuid=parent.id AND e.source_payload_hash=parent.payload_sha256
        AND captured.resource_kind='transfer' AND captured.resource_id=e.transfer_id
        AND captured.organization_id=NEW.organization_id))"""
assert LEGACY.count(AUTHOR_BRANCH) == 1 and LEGACY.count(PARENT_BRANCH) == 1
CONDITION = LEGACY.replace(
    AUTHOR_BRANCH,
    "(d.kind IN ('ovitrap','transfer_source') OR child.created_by_id=parent.created_by_id)",
).replace(PARENT_BRANCH, f"({PARENT_BRANCH} OR {TRANSFER_BRANCH})")


def guard_sql(condition):
    return f"""CREATE OR REPLACE FUNCTION reviews_reviewdependencyresolution_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'review audit facts are insert-only and never deleted'; END IF;
    IF NOT COALESCE(({condition}),FALSE) THEN
        RAISE EXCEPTION 'review audit identity or organization mismatch';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;"""


def protect_transfer_dependencies_reverse(apps, schema_editor):
    from django.db.migrations.exceptions import IrreversibleError

    if (
        apps.get_model("reviews", "ReviewDependency")
        .objects.filter(kind="transfer_source")
        .exists()
    ):
        raise IrreversibleError("Existing custody causal proof must survive downgrade.")


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0003_append_only_reviews"),
        ("inventory", "0004_signed_custody_guards"),
    ]
    operations = [
        migrations.RunSQL(guard_sql(CONDITION), guard_sql(LEGACY)),
        migrations.RunPython(migrations.RunPython.noop, protect_transfer_dependencies_reverse),
    ]
