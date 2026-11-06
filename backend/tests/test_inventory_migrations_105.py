"""Own reversible guard SQL must not remove legacy guards or organization facts."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from organizations.models import Organization
from tests.factories import OrganizationFactory


@pytest.mark.django_db(transaction=True)
def test_inventory_schema_reverse_restores_own_guards_and_retains_legacy_state():
    organization = OrganizationFactory(name="Synthetic protected legacy organization")
    original = (organization.name, organization.timezone, organization.revision)
    executor = MigrationExecutor(connection)
    restore = executor.loader.graph.leaf_nodes()
    try:
        executor.migrate([("inventory", None), ("incidents", "0001_initial")])
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT proname FROM pg_proc WHERE proname IN ('inventory_fact_guard','incident_insert_only_guard')"
            )
            assert {row[0] for row in cursor.fetchall()} == {"incident_insert_only_guard"}
    finally:
        MigrationExecutor(connection).migrate(restore)
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT proname FROM pg_proc WHERE proname IN ('inventory_fact_guard','incident_insert_only_guard')"
        )
        assert {row[0] for row in cursor.fetchall()} == {
            "inventory_fact_guard",
            "incident_insert_only_guard",
        }
    retained = Organization.objects.get(pk=organization.pk)
    assert (retained.name, retained.timezone, retained.revision) == original
