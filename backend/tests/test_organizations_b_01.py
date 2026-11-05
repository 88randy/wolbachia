"""Issue #99 acceptance: scope, serialized administration, launch and HTTP wiring."""

import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.db import connection

from organizations import services
from organizations.models import default_scope


def dimension(mode, *ids):
    return {"mode": mode, "ids": list(ids)}


def scope(centers="all", quadrants="all"):
    return {"centers": dimension(centers), "quadrants": dimension(quadrants)}


@pytest.mark.parametrize("axis", ["centers", "quadrants"])
@pytest.mark.parametrize(
    ("mode", "assigned", "expected"),
    [
        ("none", False, False),
        ("selected", False, False),
        ("selected", True, True),
        ("all", False, True),
    ],
)
def test_effective_scope_intersects_permissions_and_both_dimensions(
    monkeypatch, axis, mode, assigned, expected
):
    center, quadrant, unassigned = str(uuid4()), str(uuid4()), str(uuid4())
    member_scope = {
        "centers": dimension("selected", center),
        "quadrants": dimension("selected", quadrant),
    }
    identifier = center if axis == "centers" else quadrant
    member_scope[axis] = dimension(mode, *([identifier] if assigned else []))
    membership = SimpleNamespace(
        scope=member_scope,
        is_active=True,
        organization=SimpleNamespace(is_active=True),
        user=SimpleNamespace(is_active=True),
    )
    profile = SimpleNamespace(slug="courier", scope=scope(), permission_codes=["visit.read"])
    monkeypatch.setattr("organizations.selectors.list_active_profiles", lambda member: [profile])
    effective = services.effective_scope(membership)
    assert effective.allows("visit.read", center, quadrant) is expected
    assert not effective.allows("visit.write", center, quadrant)
    target = (unassigned, quadrant) if axis == "centers" else (center, unassigned)
    assert effective.allows("visit.read", *target) is (mode == "all")
    other = (center, unassigned) if axis == "centers" else (unassigned, quadrant)
    assert not effective.allows("visit.read", *other)


def test_effective_scope_keeps_each_actions_center_and_quadrant_grants_paired(monkeypatch):
    center, quadrant, other_center, other_quadrant = [str(uuid4()) for _ in range(4)]
    membership = SimpleNamespace(
        scope=scope(),
        is_active=True,
        organization=SimpleNamespace(is_active=True),
        user=SimpleNamespace(is_active=True),
    )
    profiles = [
        SimpleNamespace(
            slug="first",
            scope={
                "centers": dimension("selected", center),
                "quadrants": dimension("selected", quadrant),
            },
            permission_codes=["visit.read"],
        ),
        SimpleNamespace(
            slug="second",
            scope={
                "centers": dimension("selected", other_center),
                "quadrants": dimension("selected", other_quadrant),
            },
            permission_codes=["visit.read"],
        ),
        SimpleNamespace(slug="unrelated", scope=scope(), permission_codes=["report.read"]),
    ]
    monkeypatch.setattr("organizations.selectors.list_active_profiles", lambda member: profiles)
    effective = services.effective_scope(membership)
    assert effective.allows("visit.read", center, quadrant)
    assert effective.allows("visit.read", other_center, other_quadrant)
    assert not effective.allows("visit.read", center, other_quadrant)
    assert not effective.allows("visit.read", other_center, quadrant)


def test_effective_scope_clamps_corrupt_government_permissions_and_mixed_assignments(monkeypatch):
    membership = SimpleNamespace(
        scope=scope(),
        is_active=True,
        organization=SimpleNamespace(is_active=True),
        user=SimpleNamespace(is_active=True),
    )
    profiles = [
        SimpleNamespace(
            slug="government",
            scope=scope(),
            permission_codes=["portal.read", "organization.update"],
        ),
        SimpleNamespace(
            slug="admin", scope=scope(), permission_codes=["organization.update", "role.update"]
        ),
    ]
    monkeypatch.setattr("organizations.selectors.list_active_profiles", lambda member: profiles)
    assert services.effective_scope(membership).permissions == {"portal.read"}


@pytest.mark.django_db(transaction=True)
def test_concurrent_last_admin_removals_retain_one_administrator():
    from organizations.exceptions import AdministrationBusyError, LastAdministratorError
    from organizations.models import Membership, Profile
    from organizations.services import (
        MembershipChange,
        OrganizationSpec,
        create_membership,
        create_organization,
        update_membership,
    )
    from tests.factories import UserFactory

    organization = create_organization(OrganizationSpec("Race", "race-99", "MX", "UTC"))
    admin = Profile.objects.get(organization=organization, slug="admin")
    members = [create_membership(UserFactory(), organization, [admin]) for _ in range(2)]
    barrier = threading.Barrier(2, timeout=10)
    committed = threading.Event()

    def remove(member_id):
        try:
            member = Membership.objects.get(pk=member_id)
            barrier.wait()
            change = MembershipChange(
                actor=member.user,
                expected_revision=member.revision,
                profiles=[],
                scope=default_scope(),
                is_active=False,
            )
            try:
                update_membership(member, change)
            except AdministrationBusyError:
                # Retry only after the winning transaction committed, so a missing last-admin
                # guard cannot pass merely because the losing attempt hit the try-lock.
                assert committed.wait(10)
                update_membership(member, change)
            committed.set()
        except LastAdministratorError as error:
            return error.code
        else:
            return "removed"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(remove, [member.pk for member in members]))
    assert sorted(outcomes) == ["last_administrator", "removed"]
    assert (
        Membership.objects.filter(organization=organization, is_active=True, profiles=admin).count()
        == 1
    )


@pytest.mark.django_db
def test_seed_rerun_preserves_revoked_grants_and_government_boundary():
    from organizations.defaults import seed_organization_defaults
    from organizations.exceptions import GovernmentPermissionError
    from organizations.models import Profile
    from organizations.services import (
        OrganizationSpec,
        ProfileChange,
        create_organization,
        update_profile_permissions,
    )
    from tests.factories import UserFactory

    organization = create_organization(OrganizationSpec("Seed", "seed-99", "MX", "UTC"))
    assert set(
        Profile.objects.filter(organization=organization).values_list("slug", flat=True)
    ) == {
        "courier",
        "supervisor",
        "entomologist",
        "community_promoter",
        "admin",
        "coordinator",
        "warehouse",
        "regulatory",
        "government",
    }
    actor = UserFactory()
    from tests.factories import MembershipFactory

    admin = Profile.objects.get(organization=organization, slug="admin")
    MembershipFactory(user=actor, organization=organization, scope=scope()).profiles.add(admin)
    courier = Profile.objects.get(organization=organization, slug="courier")
    update_profile_permissions(courier, ProfileChange(actor, courier.revision, [], scope()))
    seed_organization_defaults(organization)
    courier.refresh_from_db()
    assert courier.permission_codes == []
    government = Profile.objects.get(organization=organization, slug="government")
    with pytest.raises(GovernmentPermissionError):
        update_profile_permissions(
            government,
            ProfileChange(actor, government.revision, ["organization.update"], scope()),
        )


@pytest.mark.django_db
def test_launch_contract_has_bounded_versioned_defaults_and_closed_items():
    from catalogs.models import Catalog
    from organizations.services import OrganizationSpec, create_organization
    from rules.models import RuleParameter

    organization = create_organization(OrganizationSpec("Launch", "launch-99", "MX", "UTC"))
    expected = {
        "max_gps_accuracy_m": (50, "m", 1, 200),
        "max_distance_to_point_m": (50, "m", 10, 200),
        "min_distance_same_block_m": (50, "m", 10, 200),
        "speed_lock_kmh": (10, "km_h", 5, 15),
        "speed_unlock_seconds": (5, "s", 3, 30),
        "clock_skew_review_seconds": (300, "s", 30, 3600),
        "closed_house_weeks_to_relocate": (2, "week", 1, 8),
        "incidents_to_relocate": (3, "count", 1, 10),
        "fuel_efficiency_min_km_l": (15, "km_l", 5, 100),
        "fuel_efficiency_max_km_l": (60, "km_l", 5, 100),
        "session_idle_minutes": (5, "min", 1, 30),
        "reminder_minutes_before_end": (60, "min", 5, 180),
        "max_paddle_reuses": (2, "count", 0, 2),
        "revisit_interval_days": (7, "day", 1, 28),
    }
    parameters = RuleParameter.objects.filter(organization=organization).prefetch_related(
        "versions"
    )
    assert {
        parameter.key: (
            parameter.versions.get().value,
            parameter.unit,
            parameter.min_value,
            parameter.max_value,
        )
        for parameter in parameters
    } == expected
    for catalog in Catalog.objects.filter(organization=organization, is_open=False):
        assert catalog.items.filter(is_active=True, is_other=False).exists()


@pytest.mark.django_db
def test_catalog_metadata_preserves_protected_other_and_used_deactivated_labels():
    from catalogs.exceptions import OtherItemLockedError
    from catalogs.serializers import CatalogItemSerializer
    from catalogs.services import deactivate_catalog_item, update_catalog_item
    from shifts.models import MotorcycleCheck
    from tests.factories import CatalogItemFactory, ShiftFactory, UserFactory

    other = CatalogItemFactory(code="other", is_other=True)
    with pytest.raises(OtherItemLockedError):
        update_catalog_item(other, {"label_es": "Changed"})
    assert CatalogItemSerializer(other).data["protected"] is True
    item = CatalogItemFactory(label_es="Historical label")
    MotorcycleCheck.objects.create(
        shift=ShiftFactory(organization=item.organization),
        item=item,
        organization=item.organization,
        result="ok",
    )
    deactivate_catalog_item(item, UserFactory())
    item.refresh_from_db()
    projection = CatalogItemSerializer(item).data
    assert projection["in_use"] is True
    assert projection["is_active"] is False
    assert projection["label_es"] == "Historical label"


@pytest.mark.django_db
def test_center_endpoint_wires_default_deny_and_organization_and_dimension_isolation(api_client):
    from organizations.models import Center
    from tests.factories import MembershipFactory, ProfileFactory

    membership = MembershipFactory(scope=scope())
    center = Center.objects.create(
        organization=membership.organization, code="C-01", name="Assigned"
    )
    foreign = Center.objects.create(
        organization=MembershipFactory().organization, code="C-03", name="Foreign"
    )
    api_client.force_authenticate(membership.user)
    assert api_client.get("/api/v1/centers/").status_code == 403
    profile = ProfileFactory(
        organization=membership.organization,
        permission_codes=["center.read", "role.update"],
        scope=scope(),
    )
    membership.profiles.add(profile)
    membership.scope = {
        "centers": dimension("selected", str(center.pk)),
        "quadrants": dimension("selected", str(uuid4())),
    }
    membership.save()
    unassigned = Center.objects.create(
        organization=membership.organization, code="C-02", name="Unassigned"
    )
    response = api_client.get("/api/v1/centers/", {"code": center.code})
    assert response.status_code == 200
    assert response.data["results"] == [
        {"id": str(center.pk), "code": center.code, "name": center.name}
    ]
    for hidden in [unassigned, foreign]:
        assert api_client.get(f"/api/v1/centers/{hidden.pk}/").status_code == 404
    payload = {
        "permissions": ["center.read"],
        "scope": {
            "centers": dimension("selected", str(foreign.pk)),
            "quadrants": dimension("selected", str(uuid4())),
        },
        "expected_revision": profile.revision,
    }
    assert (
        api_client.put(
            f"/api/v1/roles/{profile.pk}/permissions/", payload, format="json"
        ).status_code
        == 404
    )
    payload["scope"]["centers"] = dimension("selected", str(center.pk))
    assert (
        api_client.put(
            f"/api/v1/roles/{profile.pk}/permissions/", payload, format="json"
        ).status_code
        == 404
    )


def png_chunk(kind, content):
    import struct
    import zlib

    return (
        struct.pack(">I", len(content))
        + kind
        + content
        + struct.pack(">I", zlib.crc32(kind + content))
    )


def raster_logo(pixel_stream=b"\x00\x00\x00\x00", metadata=b"private metadata"):
    import struct
    import zlib

    from organizations.logo import PNG_SIGNATURE

    header = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + png_chunk(b"IHDR", header)
        + png_chunk(b"tEXt", metadata)
        + png_chunk(b"IDAT", zlib.compress(pixel_stream))
        + png_chunk(b"IEND", b"")
    )


def test_logo_strips_metadata_and_refuses_mime_magic_and_decompression_mismatches():
    from django.core.files.uploadedfile import SimpleUploadedFile

    from core.exceptions import FieldValidationError
    from organizations.logo import MAX_LOGO_BYTES, validate_logo

    sanitized = validate_logo(
        SimpleUploadedFile("logo.png", raster_logo(), content_type="image/png")
    )
    assert b"private metadata" not in sanitized
    assert (
        validate_logo(SimpleUploadedFile("logo.png", sanitized, content_type="image/png"))
        == sanitized
    )
    for content, mime in [
        (b"<svg/>", "image/svg+xml"),
        (b"<html/>", "image/png"),
        (raster_logo(b"\x00" * 100), "image/png"),
        (b"x" * (MAX_LOGO_BYTES + 1), "image/png"),
        (sanitized + b"<script/>", "image/png"),
    ]:
        with pytest.raises(FieldValidationError):
            validate_logo(SimpleUploadedFile("logo.png", content, content_type=mime))


@pytest.mark.django_db
def test_settings_and_role_revisions_reject_stale_or_last_admin_changes_atomically():
    from core.exceptions import ImmutableRecordError
    from organizations.exceptions import LastAdministratorError, StaleRevisionError
    from organizations.models import ConfigurationRevision, Profile, all_scope
    from organizations.services import (
        AdminSpec,
        OrganizationChange,
        OrganizationSpec,
        ProfileChange,
        bootstrap_organization,
        update_organization,
        update_profile_permissions,
    )

    organization, actor = bootstrap_organization(
        OrganizationSpec("Audit", "audit-99", "MX", "UTC"),
        AdminSpec("admin-99", "admin-99@example.test"),
    )
    changed = update_organization(
        organization,
        OrganizationChange(
            actor,
            organization.revision,
            {"name": "Updated", "epi_week": "mmwr", "support_contact": "Work desk"},
        ),
    )
    history = ConfigurationRevision.objects.filter(
        organization=organization, kind="organization"
    ).order_by("revision")
    assert [revision.snapshot["name"] for revision in history] == ["Audit", "Updated"]
    assert history.last().created_by == actor
    with pytest.raises(StaleRevisionError):
        update_organization(changed, OrganizationChange(actor, 1, {"name": "Stale"}))
    changed.refresh_from_db()
    assert changed.name == "Updated"
    assert history.count() == 2
    admin = Profile.objects.get(organization=organization, slug="admin")
    with pytest.raises(LastAdministratorError):
        update_profile_permissions(admin, ProfileChange(actor, admin.revision, [], all_scope()))
    admin.refresh_from_db()
    assert "role.update" in admin.permission_codes
    with pytest.raises(ImmutableRecordError):
        history.first().save()
    from django.db import DatabaseError, transaction

    with (
        pytest.raises(DatabaseError, match="configuration revisions are insert-only"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            "UPDATE organizations_configurationrevision SET snapshot = %s WHERE id = %s",
            ["{}", history.first().pk],
        )


@pytest.mark.django_db
def test_scope_data_migration_preserves_selected_ids_and_denies_empty_arrays():
    import importlib

    from django.apps import apps

    from tests.factories import MembershipFactory, ProfileFactory

    center, quadrant = str(uuid4()), str(uuid4())
    selected = MembershipFactory(scope={"centers": [center], "quadrants": [quadrant]})
    empty = MembershipFactory(scope={"centers": [], "quadrants": []})
    profile = ProfileFactory(organization=selected.organization)
    migration = importlib.import_module(
        "organizations.migrations.0005_explicit_scope_and_revision_guard"
    )
    migration.convert_scopes(apps, SimpleNamespace(connection=connection))
    selected.refresh_from_db()
    empty.refresh_from_db()
    profile.refresh_from_db()
    assert selected.scope == {
        "centers": dimension("selected", center),
        "quadrants": dimension("selected", quadrant),
    }
    assert empty.scope == default_scope()
    assert profile.scope == scope()


@pytest.mark.django_db
def test_fuel_bounds_preserve_order_across_scheduled_transitions():
    from datetime import UTC, datetime, timedelta
    from decimal import Decimal
    from unittest.mock import patch

    from core.exceptions import FieldValidationError
    from organizations.services import OrganizationSpec, create_organization
    from rules.models import RuleParameter
    from rules.services import RuleVersionSpec, create_rule_version, void_rule_version
    from tests.factories import UserFactory

    now = datetime(2026, 11, 5, 12, tzinfo=UTC)
    with patch("django.utils.timezone.now", return_value=now):
        organization = create_organization(OrganizationSpec("Fuel", "fuel-99", "MX", "UTC"))
        lower = RuleParameter.objects.get(organization=organization, key="fuel_efficiency_min_km_l")
        upper = RuleParameter.objects.get(organization=organization, key="fuel_efficiency_max_km_l")
        actor = UserFactory()
        scheduled_upper = create_rule_version(
            upper,
            RuleVersionSpec(Decimal(80), (now + timedelta(days=2)).date(), "Raise upper threshold"),
            actor,
        )
        with pytest.raises(FieldValidationError):
            create_rule_version(
                lower,
                RuleVersionSpec(
                    Decimal(80), (now + timedelta(days=3)).date(), "Equal bounds are unsafe"
                ),
                actor,
            )
        create_rule_version(
            lower,
            RuleVersionSpec(
                Decimal(70), (now + timedelta(days=3)).date(), "Keep ordered thresholds"
            ),
            actor,
        )
        with pytest.raises(FieldValidationError):
            create_rule_version(
                upper,
                RuleVersionSpec(
                    Decimal(65), (now + timedelta(days=4)).date(), "Would cross lower bound"
                ),
                actor,
            )

        with pytest.raises(FieldValidationError):
            void_rule_version(
                scheduled_upper, actor, "Would invalidate the scheduled lower bound", "other"
            )


@pytest.mark.django_db
def test_seed_plan_reports_missing_items_and_versions_in_existing_launch_definitions():
    from organizations.defaults import plan_organization_defaults
    from tests.factories import CatalogFactory, OrganizationFactory, RuleParameterFactory

    organization = OrganizationFactory()
    CatalogFactory(organization=organization, slug="motorcycle-check-item", is_open=False)
    RuleParameterFactory(
        organization=organization, key="speed_unlock_seconds", unit="s", min_value=3, max_value=30
    )
    plan = plan_organization_defaults(organization)
    assert "motorcycle-check-item" in plan.missing_catalogs
    assert "speed_unlock_seconds" in plan.missing_parameters
    assert "coordinator" in plan.missing_profiles


def test_default_admin_bundle_covers_courier_permissions_within_scope(monkeypatch):
    from field_sync.permissions import FIELD_EVENT_SYNC
    from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS

    center, quadrant, foreign_center, foreign_quadrant = [str(uuid4()) for _ in range(4)]
    membership = SimpleNamespace(
        scope={
            "centers": dimension("selected", center),
            "quadrants": dimension("selected", quadrant),
        },
        is_active=True,
        organization=SimpleNamespace(is_active=True),
        user=SimpleNamespace(is_active=True),
    )
    admin = SimpleNamespace(
        slug="admin", scope=scope(), permission_codes=DEFAULT_PROFILE_PERMISSIONS["admin"]
    )
    monkeypatch.setattr("organizations.selectors.list_active_profiles", lambda member: [admin])

    effective = services.effective_scope(membership)

    for permission in DEFAULT_PROFILE_PERMISSIONS["courier"]:
        assert effective.allows(permission, center, quadrant), permission
    assert not effective.allows(FIELD_EVENT_SYNC, foreign_center, quadrant)
    assert not effective.allows(FIELD_EVENT_SYNC, center, foreign_quadrant)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("entry_point", ["configuration", "defaults", "permissions", "rules"])
def test_organization_serialization_allows_catalog_writer_foreign_keys(entry_point):
    """Commit a real catalog writer while each organization serialization lock is held.

    The SQL wrapper gates scheduling only. A nested upgrade to FOR UPDATE fails the
    same commit handshake, so fixing just the outer seed lock cannot pass this test.
    """
    from queue import Queue

    from django.db import DatabaseError

    from catalogs.models import CatalogItem
    from catalogs.services import CatalogItemSpec, create_catalog_item
    from organizations.defaults import seed_default_permission_codes, seed_organization_defaults
    from rules.seeds import seed_default_rule_parameters
    from tests.factories import CatalogFactory, OrganizationFactory, UserFactory

    organization = OrganizationFactory()
    catalog = CatalogFactory(organization=organization, slug="lock-order-probe")
    author = UserFactory()
    requests, completed = Queue(), Queue()
    wait_seconds = 15

    def write_catalog_items():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '1s'")
            sequence = 0
            while requests.get(timeout=wait_seconds) is not None:
                try:
                    item = create_catalog_item(
                        catalog, CatalogItemSpec(f"lock-probe-{sequence}", "Lock probe"), author
                    )
                except DatabaseError as error:
                    completed.put(error)
                else:
                    # create_catalog_item returns only after its FK checks and COMMIT.
                    completed.put(item.pk)
                sequence += 1
        finally:
            connection.close()

    def probe_after_organization_lock(execute, sql, params, many, context):
        result = execute(sql, params, many, context)
        if (
            sql.startswith("SELECT")
            and 'FROM "organizations_organization"' in sql
            and " FOR " in sql
        ):
            requests.put(True)
            outcome = completed.get(timeout=wait_seconds)
            assert not isinstance(outcome, DatabaseError), str(outcome)
        return result

    with ThreadPoolExecutor(max_workers=1) as executor:
        writer = executor.submit(write_catalog_items)
        try:
            with connection.execute_wrapper(probe_after_organization_lock):
                if entry_point == "configuration":
                    with services.lock_organization_configuration(organization.pk):
                        pass
                elif entry_point == "defaults":
                    seed_organization_defaults(organization)
                elif entry_point == "permissions":
                    seed_default_permission_codes(organization)
                else:
                    seed_default_rule_parameters(organization)
        finally:
            requests.put(None)
            writer.result(timeout=wait_seconds)
    assert CatalogItem.objects.filter(catalog=catalog, code__startswith="lock-probe-").exists()


@pytest.mark.django_db
@pytest.mark.parametrize("operation", ["create", "change"])
def test_membership_delegation_checks_each_profiles_effective_scope(operation):
    from rest_framework.exceptions import NotFound

    from organizations.models import Center, Membership
    from tests.factories import MembershipFactory, OrganizationFactory, ProfileFactory, UserFactory

    organization = OrganizationFactory()
    center_a = Center.objects.create(organization=organization, code="DELEGATE-A", name="Center A")
    center_b = Center.objects.create(organization=organization, code="DELEGATE-B", name="Center B")
    quadrant_a, quadrant_b = str(uuid4()), str(uuid4())
    scope_a = {
        "centers": dimension("selected", str(center_a.pk)),
        "quadrants": dimension("selected", quadrant_a),
    }
    scope_b = {
        "centers": dimension("selected", str(center_b.pk)),
        "quadrants": dimension("selected", quadrant_b),
    }
    reader_a = ProfileFactory(
        organization=organization, scope=scope_a, permission_codes=["visit.read"]
    )
    reader_b = ProfileFactory(
        organization=organization, scope=scope_b, permission_codes=["report.read"]
    )
    manager = ProfileFactory(
        organization=organization, scope=scope(), permission_codes=["role.update"]
    )
    actor = MembershipFactory(organization=organization, scope=scope())
    actor.profiles.set([manager, reader_a, reader_b])
    recipient = UserFactory()

    def assign_recipient(user):
        change = services.MembershipChange(actor.user, 1, [reader_a, reader_b], scope())
        if operation == "create":
            return services.create_managed_membership(user, organization, change)
        member = MembershipFactory(user=user, organization=organization)
        return services.update_membership(member, change)

    assigned = assign_recipient(recipient)
    effective = services.effective_scope(assigned)
    assert assigned.scope == scope()
    assert effective.allows("visit.read", str(center_a.pk), quadrant_a)
    assert effective.allows("report.read", str(center_b.pk), quadrant_b)
    assert not effective.allows("visit.read", str(center_b.pk), quadrant_b)
    assert not effective.allows("report.read", str(center_a.pk), quadrant_a)

    # Holding a profile through a narrower actor membership does not authorize its
    # full stored scope. This also guards against dropping delegation checks entirely.
    actor.scope = scope_a
    actor.save(update_fields=["scope"])
    denied_recipient = UserFactory()
    with pytest.raises(NotFound):
        assign_recipient(denied_recipient)
    denied = Membership.objects.filter(user=denied_recipient, organization=organization).first()
    if operation == "create":
        assert denied is None
    else:
        assert denied.scope == default_scope()
        assert not denied.profiles.exists()
        assert denied.revision == 1


@pytest.mark.django_db
@pytest.mark.parametrize("is_compatible", [False, True])
@pytest.mark.parametrize(
    ("missing_key", "is_scheduled"),
    [
        ("fuel_efficiency_min_km_l", False),
        ("fuel_efficiency_min_km_l", True),
        ("fuel_efficiency_max_km_l", False),
        ("fuel_efficiency_max_km_l", True),
    ],
)
def test_missing_fuel_default_validates_current_and_scheduled_pair_atomically(
    monkeypatch, missing_key, is_scheduled, is_compatible
):
    from datetime import UTC, datetime, timedelta

    from catalogs.models import Catalog
    from core.exceptions import FieldValidationError
    from organizations.defaults import seed_organization_defaults
    from organizations.models import Profile
    from rules.models import RuleParameter, RuleParameterVersion, Unit, ValueType
    from tests.factories import (
        OrganizationFactory,
        RuleParameterFactory,
        RuleParameterVersionFactory,
    )

    now = datetime(2026, 11, 5, 12, tzinfo=UTC)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    organization = OrganizationFactory()
    is_missing_minimum = missing_key == "fuel_efficiency_min_km_l"
    counterpart = RuleParameterFactory(
        organization=organization,
        key="fuel_efficiency_max_km_l" if is_missing_minimum else "fuel_efficiency_min_km_l",
        value_type=ValueType.DECIMAL,
        unit=Unit.KILOMETERS_PER_LITER,
    )
    counterpart_value = (
        (20 if is_missing_minimum else 10) if is_compatible else (10 if is_missing_minimum else 70)
    )
    current = RuleParameterVersionFactory(
        parameter=counterpart,
        value=(60 if is_missing_minimum else 15) if is_scheduled else counterpart_value,
        effective_from=now - timedelta(days=1),
    )
    expected_versions = {current.pk}
    if is_scheduled:
        scheduled = RuleParameterVersionFactory(
            parameter=counterpart, value=counterpart_value, effective_from=now + timedelta(days=1)
        )
        expected_versions.add(scheduled.pk)

    if is_compatible:
        seed_organization_defaults(organization)
        seeded = RuleParameter.objects.get(organization=organization, key=missing_key)
        assert seeded.versions.get().value == (15 if is_missing_minimum else 60)
        assert set(counterpart.versions.values_list("pk", flat=True)) == expected_versions
        return

    with pytest.raises(FieldValidationError) as conflict:
        seed_organization_defaults(organization)

    assert conflict.value.fields["value"][0]["code"] == "fuel_bounds_conflict"
    assert (
        set(
            RuleParameterVersion.objects.filter(organization=organization).values_list(
                "pk", flat=True
            )
        )
        == expected_versions
    )
    assert list(
        RuleParameter.objects.filter(organization=organization).values_list("pk", flat=True)
    ) == [counterpart.pk]
    counterpart.refresh_from_db()
    assert counterpart.min_value is None  # the seed's bound updates rolled back too
    assert not Profile.objects.filter(organization=organization).exists()
    assert not Catalog.objects.filter(organization=organization).exists()


@pytest.mark.django_db(transaction=True)
def test_closed_catalog_seed_and_same_code_request_finish_without_deadlock():
    """Hold a seeded code uncommitted, then release commit only once the request waits.

    Without the Catalog lock the request holds that row and waits on the unique
    index; the seed's deferred Catalog FK check then closes the deadlock cycle.
    """
    from queue import Queue
    from time import monotonic

    from django.db import transaction

    from catalogs.models import CatalogItem
    from catalogs.seeds import seed_default_catalogs
    from catalogs.services import CatalogItemSpec, create_catalog_item
    from core.exceptions import FieldValidationError
    from tests.factories import CatalogFactory, OrganizationFactory, UserFactory

    organization = OrganizationFactory()
    catalog = CatalogFactory(organization=organization, slug="motorcycle-check-item", is_open=False)
    author = UserFactory()
    code = "brakes"
    wait_seconds = 15
    inserted = threading.Barrier(2, timeout=wait_seconds)
    release_commit = threading.Event()
    request_started = threading.Event()
    backend_pids = Queue()

    def seed_uncommitted():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '5s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_pids.put(("seed", cursor.fetchone()[0]))
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SET CONSTRAINTS ALL DEFERRED")
                seed_default_catalogs(organization)
                item = CatalogItem.objects.get(catalog=catalog, code=code)
                inserted.wait()
                assert release_commit.wait(wait_seconds)
            return item.pk, item.label_es
        finally:
            connection.close()

    def request_same_code():
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '5s'")
                cursor.execute("SELECT pg_backend_pid()")
                backend_pids.put(("request", cursor.fetchone()[0]))
            inserted.wait()
            request_started.set()
            create_catalog_item(catalog, CatalogItemSpec(code, "Request brakes"), author)
        except FieldValidationError as error:
            return error
        else:
            return None
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        seed = executor.submit(seed_uncommitted)
        request = executor.submit(request_same_code)
        try:
            pids = dict(backend_pids.get(timeout=wait_seconds) for _ in range(2))
            assert request_started.wait(wait_seconds)
            deadline = monotonic() + wait_seconds
            with connection.cursor() as cursor:
                while monotonic() < deadline:
                    cursor.execute(
                        "SELECT %s = ANY(pg_blocking_pids(%s))", [pids["seed"], pids["request"]]
                    )
                    if cursor.fetchone()[0]:
                        break
                else:
                    pytest.fail("The same-code request never waited behind the uncommitted seed.")
        finally:
            release_commit.set()
            seeded_id, seeded_label = seed.result(timeout=wait_seconds)
            outcome = request.result(timeout=wait_seconds)

    assert isinstance(outcome, FieldValidationError)
    assert outcome.fields["code"][0]["code"] == "duplicate_code"
    assert CatalogItem.objects.filter(catalog=catalog, code=code).count() == 1
    item = CatalogItem.objects.get(catalog=catalog, code=code)
    assert (item.pk, item.label_es) == (seeded_id, seeded_label)
