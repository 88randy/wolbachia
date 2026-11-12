"""Rows never mix organizations: composite FKs (organization_id, fk) -> parent (organization_id, id)."""

import importlib
from uuid import UUID

import pytest
from django.db import IntegrityError, connection, transaction

from organizations.models import Organization
from tests.lab_support import capture_bag, lab_context, receive

pytestmark = pytest.mark.django_db

migration = importlib.import_module("lab.migrations.0013_org_same_fk_not_valid")
PAIRS = migration.PAIRS
# Chains read by lab/access.py (scoped_readings/scoped_bags) and the lab facts hanging off a bag.
CRITICAL = {
    ("ovitraps_ovitrapreading", "ovitrap_id"),
    ("ovitraps_ovitrapreading", "point_version_id"),
    ("ovitraps_ovitrapreading", "event_id"),
    ("ovitraps_ovitrap", "sampling_point_id"),
    ("geography_samplingpoint", "block_id"),
    ("geography_block", "quadrant_id"),
    ("geography_quadrant", "center_id"),
    ("ovitraps_bag", "reading_id"),
    ("ovitraps_bag", "event_id"),
    ("lab_bagreceipt", "bag_id"),
    ("lab_bagreceipt", "reading_id"),
}


def test_every_guarded_pair_is_a_validated_composite_foreign_key():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT conrelid::regclass::text, conname, convalidated, array_length(conkey, 1) "
            "FROM pg_constraint WHERE conname LIKE 'orgfk\\_%%'"
        )
        found = {name: (valid, width) for _table, name, valid, width in cursor.fetchall()}
    assert len(found) == len(PAIRS)
    for table, column, _parent in PAIRS:
        assert found[migration.constraint_name(table, column)] == (True, 2), (table, column)
    assert {(table, column) for table, column, _parent in PAIRS} >= CRITICAL


def move_children_to(cursor, table: str, column: str, name: str, organization_id: UUID) -> None:
    """Point every child row at another organization while its parent stays put."""
    with transaction.atomic():
        # Immutability triggers would stop the probe first; FK checks are internal triggers.
        cursor.execute(f'ALTER TABLE "{table}" DISABLE TRIGGER USER')  # noqa: S608
        cursor.execute(f'SET CONSTRAINTS "{name}" IMMEDIATE')
        cursor.execute(
            f'UPDATE "{table}" SET organization_id = %s WHERE "{column}" IS NOT NULL',  # noqa: S608
            [organization_id],
        )


def test_cross_organization_child_is_rejected_by_the_database(monkeypatch):
    context = lab_context(monkeypatch)
    bag = capture_bag(context, "ORG-GUARD-1", new_source=True, has_eggs=True)
    receive(context, bag)
    other = Organization.objects.create(
        name="Other", slug="other-org-guard", country="MX", timezone="America/Mexico_City"
    )
    rejected: set[tuple[str, str]] = set()
    with connection.cursor() as cursor:
        for table, column, _parent in PAIRS:
            cursor.execute(
                f'SELECT count(*) FROM "{table}" WHERE "{column}" IS NOT NULL'  # noqa: S608
            )
            if not cursor.fetchone()[0]:
                continue
            name = migration.constraint_name(table, column)
            with pytest.raises(IntegrityError, match=name):
                move_children_to(cursor, table, column, name, other.pk)
            rejected.add((table, column))
    assert rejected >= CRITICAL, sorted(CRITICAL - rejected)
