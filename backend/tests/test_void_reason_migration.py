"""Exercise the actual legacy schema, catalog data seed, backfill and trigger restoration."""

from functools import partial

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

from catalogs.models import Catalog
from tests.factories import (
    FieldEventFactory,
    OrganizationFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
    UserFactory,
    WidgetFactory,
)


@pytest.mark.django_db(transaction=True)
def test_legacy_voids_are_backfilled_and_guard_triggers_are_enabled():
    organization = OrganizationFactory()
    another = OrganizationFactory()
    author = UserFactory()
    legacy = [
        factory(
            organization=organization,
            voided_at=timezone.now(),
            voided_by=author,
            void_reason="legacy text stays",
            void_reason_code="other",
        )
        for factory in (
            FieldEventFactory,
            partial(
                RuleParameterVersionFactory,
                parameter=RuleParameterFactory(organization=organization),
            ),
            WidgetFactory,
        )
    ]
    intact = WidgetFactory(organization=organization)
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [
        ("catalogs", "0002_item_input_validation"),
        ("field_sync", "0002_clock_skew_bigint"),
        ("rules", "0002_version_void_and_guard"),
        ("testapp", "0002_widget_code"),
    ]
    try:
        executor.migrate(previous)
        # These rows now exist without the code column, as before issue #80.
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        for record in legacy:
            record.refresh_from_db()
            assert (record.void_reason_code, record.void_reason) == ("other", "legacy text stays")
        intact.refresh_from_db()
        assert (intact.void_reason_code, intact.void_reason, intact.voided_at) == ("", "", None)
        assert (
            Catalog.objects.filter(
                organization_id__in=[organization.pk, another.pk], slug="void-reason"
            ).count()
            == 2
        )
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN (%s, %s)",
                ["field_sync_fieldevent_guard", "rules_ruleparameterversion_guard"],
            )
            assert dict(cursor.fetchall()) == {
                "field_sync_fieldevent_guard": "O",
                "rules_ruleparameterversion_guard": "O",
            }
    finally:
        MigrationExecutor(connection).migrate(latest)
