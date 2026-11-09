"""Extend the existing exact causal guard with a genuine same-author supply receipt."""

from importlib import import_module

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

PREVIOUS = import_module("reviews.migrations.0004_transfer_source_dependency")
PARENT = PREVIOUS.PARENT_BRANCH
SUPPLY = """(d.kind='supply_source' AND d.declared_id=parent.id
    AND child.type='supplies.reconcile' AND parent.type='supplies.receive'
    AND child.created_by_id=parent.created_by_id
    AND EXISTS(SELECT 1 FROM inventory_supplysourcelink link
      JOIN inventory_supplyevent e ON e.id=link.event_id
      JOIN reviews_reviewsourcesnapshot captured ON captured.source_event_id=child.id
      WHERE link.source_event_id=parent.id AND link.organization_id=NEW.organization_id
      AND e.kind='receive' AND e.organization_id=NEW.organization_id
      AND e.declared_source_uuid=parent.id AND e.source_payload_hash=parent.payload_sha256
      AND captured.organization_id=NEW.organization_id
      AND captured.resource_kind='supply_assignment' AND captured.resource_id=e.assignment_id
      AND child.payload->>'assignment_id'=e.assignment_id::text))"""
assert PREVIOUS.CONDITION.count(PARENT) == 1
CONDITION = PREVIOUS.CONDITION.replace(PARENT, f"({PARENT} OR {SUPPLY})")


def protect_reverse(apps, schema_editor):
    if apps.get_model("reviews", "ReviewDependency").objects.filter(kind="supply_source").exists():
        raise IrreversibleError("Retain signed supply receipt dependencies.")


class Migration(migrations.Migration):
    dependencies = [
        ("reviews", "0004_transfer_source_dependency"),
        ("inventory", "0005_courier_supplies"),
    ]
    operations = [
        migrations.RunSQL(PREVIOUS.guard_sql(CONDITION), PREVIOUS.guard_sql(PREVIOUS.CONDITION)),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
