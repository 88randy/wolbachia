from datetime import timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from accounts.permissions import ADMIN_AUTH_PERMISSION_CODES
from catalogs import permissions as catalog_codes
from catalogs.models import Catalog, CatalogItem
from catalogs.seeds import DEFAULT_CATALOG_SEEDS
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from fleet.permissions import MOTORCYCLE_SERVICE_CLEAR
from organizations.defaults import (
    DEFAULT_PROFILE_PERMISSIONS,
    seed_default_permission_codes,
    seed_organization_defaults,
)
from organizations.models import Organization, Profile
from organizations.services import (
    DEFAULT_PROFILE_SEEDS,
    AdminSpec,
    OrganizationSpec,
    bootstrap_organization,
    create_organization,
    seed_default_profiles,
)
from reviews.permissions import REVIEW_ITEM_DECIDE, REVIEW_ITEM_READ
from rules import permissions as rule_codes
from rules.models import RuleParameter, RuleParameterVersion
from rules.seeds import DEFAULT_PARAMETER_SEEDS, seed_default_rule_parameters
from shifts.permissions import (
    MOTORCYCLE_MANAGE,
    MOTORCYCLE_READ,
    MOTORCYCLE_UNBLOCK,
    SHIFT_READ,
    SHIFT_VALIDATE,
)
from tests.factories import OrganizationFactory
from uploads.limits import FIELD_UPLOAD

pytestmark = pytest.mark.django_db

SPEC = OrganizationSpec(name="Acme", slug="acme", country="MX", timezone="America/Mexico_City")

CLOSED_CATALOGS = {"motorcycle-check-item", "ovitrap-finding"}


def current_values(organization: Organization) -> dict[str, Decimal | None]:
    versions = {
        v.parameter.key: v.value
        for v in RuleParameterVersion.objects.filter(organization=organization).select_related(
            "parameter"
        )
    }
    return {
        p.key: versions.get(p.key) for p in RuleParameter.objects.filter(organization=organization)
    }


def test_create_organization_seeds_catalogs_and_downloadable_rules(api_client, make_member) -> None:
    organization = create_organization(SPEC)

    assert (
        Catalog.objects.filter(organization=organization).count()
        == len(DEFAULT_CATALOG_SEEDS)
        == 12
    )
    assert RuleParameter.objects.filter(organization=organization).count() == len(
        DEFAULT_PARAMETER_SEEDS
    )
    user, _ = make_member(organization, [rule_codes.RULE_PARAMETER_READ])
    api_client.force_authenticate(user)

    response = api_client.get("/api/v1/field/rules/")

    assert response.status_code == 200
    pin = next(row for row in response.data["parameters"] if row["key"] == "pin_max_attempts")
    assert (pin["value"], pin["value_type"], pin["unit"]) == (3, "integer", "count")
    assert pin["version_id"] is not None


def test_bootstrap_organization_is_seeded_too() -> None:
    organization, _ = bootstrap_organization(SPEC, AdminSpec("boss", "boss@example.test"))

    assert Catalog.objects.filter(organization=organization).exists()
    assert RuleParameter.objects.filter(organization=organization).exists()


@pytest.mark.parametrize(
    ("key", "default"), [("revisit_interval_days", 7), ("pin_max_attempts", 3)]
)
def test_seed_command_adds_a_parameter_to_an_organization_seeded_before_it_existed(
    monkeypatch,
    key,
    default,
) -> None:
    organization = OrganizationFactory()
    older = tuple(s for s in DEFAULT_PARAMETER_SEEDS if s.key != key)
    monkeypatch.setattr("rules.seeds.DEFAULT_PARAMETER_SEEDS", older)
    seed_default_rule_parameters(organization)
    monkeypatch.undo()
    assert key not in current_values(organization)
    before = RuleParameterVersion.objects.filter(organization=organization).count()

    assert key in run_command("--organization", organization.slug)
    assert key not in current_values(organization)
    run_command("--organization", organization.slug, "--apply")
    run_command("--organization", organization.slug, "--apply")

    assert current_values(organization)[key] == default
    assert RuleParameterVersion.objects.filter(organization=organization).count() == before + 1


def test_seeded_versions_use_the_seed_reason_and_have_no_author() -> None:
    organization = create_organization(SPEC)

    version = RuleParameterVersion.objects.filter(organization=organization).first()

    assert version.reason == "seed: design brief"
    assert version.created_by is None


def test_seeded_parameters_have_the_expected_types_and_units() -> None:
    organization = create_organization(SPEC)

    fuel = RuleParameter.objects.get(organization=organization, key="fuel_efficiency_min_km_l")
    speed = RuleParameter.objects.get(organization=organization, key="speed_lock_kmh")

    assert (fuel.value_type, fuel.unit) == ("decimal", "km_l")
    assert (speed.value_type, speed.unit) == ("integer", "km_h")
    target = RuleParameter.objects.get(organization=organization, key="daily_task_target")
    assert (target.value_type, target.unit, target.min_value, target.max_value) == (
        "integer",
        "count",
        Decimal(1),
        Decimal(200),
    )
    assert current_values(organization)["daily_task_target"] == 40
    for key, default, minimum, maximum in (
        ("lab_count_plausibility_limit", 1000, 100, 10000),
        ("lab_recount_sample_per_100", 5, 1, 20),
    ):
        parameter = RuleParameter.objects.get(organization=organization, key=key)
        assert (parameter.value_type, parameter.unit, parameter.min_value, parameter.max_value) == (
            "integer",
            "count",
            Decimal(minimum),
            Decimal(maximum),
        )
        assert current_values(organization)[key] == default


def test_catalogs_follow_the_open_and_closed_defaults() -> None:
    organization = create_organization(SPEC)

    closed = set(
        Catalog.objects.filter(organization=organization, is_open=False).values_list(
            "slug", flat=True
        )
    )

    assert closed == CLOSED_CATALOGS


def test_catalogs_have_the_expected_initial_items() -> None:
    organization = create_organization(SPEC)

    for catalog in Catalog.objects.filter(organization=organization):
        codes_in_catalog = [item.code for item in catalog.items.all()]
        from catalogs.seeds import CLOSED_CATALOG_ITEMS

        expected = (
            ["other"] if catalog.is_open else [row[0] for row in CLOSED_CATALOG_ITEMS[catalog.slug]]
        )
        if catalog.slug == "ovitrap-finding":
            expected.append("other")
        if catalog.slug == "paddle-type":
            expected.insert(0, "standard")
        if catalog.slug == "void-reason":
            expected = ["data-entry-error", "duplicate-record", "wrong-location", "other"]
        assert codes_in_catalog == expected
    other = CatalogItem.objects.filter(organization=organization, is_other=True).first()
    assert (other.label_es, other.label_en, other.is_active) == (
        "Otro (especificar)",
        "Other (specify)",
        True,
    )


def test_seed_is_idempotent() -> None:
    organization = create_organization(SPEC)
    counts = (
        Catalog.objects.count(),
        CatalogItem.objects.count(),
        RuleParameter.objects.count(),
        RuleParameterVersion.objects.count(),
    )

    seed_organization_defaults(organization)
    seed_organization_defaults(organization)

    assert counts == (
        Catalog.objects.count(),
        CatalogItem.objects.count(),
        RuleParameter.objects.count(),
        RuleParameterVersion.objects.count(),
    )


@pytest.mark.parametrize(
    ("key", "default", "changed"), [("speed_lock_kmh", 10, 12), ("pin_max_attempts", 3, 4)]
)
def test_seed_never_adds_a_second_version_to_a_parameter_an_admin_changed(
    key, default, changed
) -> None:
    organization = create_organization(SPEC)
    parameter = RuleParameter.objects.get(organization=organization, key=key)
    RuleParameterVersion.objects.create(
        organization=organization,
        parameter=parameter,
        value=changed,
        effective_from=timezone.now() + timedelta(days=3),
        effective_date=(timezone.now() + timedelta(days=3)).date(),
        reason="admin change",
    )

    seed_organization_defaults(organization)

    assert sorted(parameter.versions.values_list("value", flat=True)) == [default, changed]


def test_seed_keeps_admin_edits_to_catalog_labels() -> None:
    organization = create_organization(SPEC)
    Catalog.objects.filter(organization=organization, slug="void-reason").update(label_es="Editado")

    item = CatalogItem.objects.get(
        catalog__organization=organization, catalog__slug="void-reason", code="data-entry-error"
    )
    item.label_es = "Edited"
    item.is_active = False
    item.save()

    seed_organization_defaults(organization)

    item.refresh_from_db()
    assert (item.label_es, item.is_active) == ("Edited", False)
    assert Catalog.objects.get(organization=organization, slug="void-reason").label_es == "Editado"


def test_seed_does_not_cross_organizations() -> None:
    first = create_organization(SPEC)
    second = create_organization(OrganizationSpec("Beta", "beta", "MX", "America/Mexico_City"))

    assert Catalog.objects.filter(organization=first).count() == 12
    assert Catalog.objects.filter(organization=second).count() == 12
    assert Catalog.objects.count() == 24


def test_default_profiles_get_the_permission_codes_of_the_plan() -> None:
    organization = create_organization(SPEC)

    by_slug = {
        p.slug: set(p.permission_codes) for p in Profile.objects.filter(organization=organization)
    }

    reader = {
        catalog_codes.CATALOG_READ,
        rule_codes.RULE_PARAMETER_READ,
        "organization.read",
        "center.read",
        "notification.read",
        "notification_preference.update",
    }
    assert by_slug["courier"] == {
        "sample.collect",
        "sample.void",
        "community_activity.read",
        "community_activity.create",
        "supply_assignment.receive",
        "supply_assignment.reconcile",
        "incident.read",
        "incident.create",
        *reader,
        FIELD_EVENT_SYNC,
        FIELD_BOOTSTRAP,
        MOTORCYCLE_READ,
        FIELD_UPLOAD,
    }
    assert by_slug["supervisor"] == {
        "release.read",
        "training.read",
        "community_activity.read",
        "community_activity.void",
        "inventory.reconcile",
        "egg_count.void",
        "transfer.read",
        "transfer.receive",
        "discrepancy.read",
        "discrepancy.close",
        "relocation.decide",
        "quadrant.close",
        "intervention.read",
        "intervention.create",
        "supply_type.read",
        "location.read",
        "lot.read",
        "lot.create",
        "lot.update",
        "condition.create",
        "incident.read",
        "incident.create",
        "incident.close",
        "incident.reassign",
        "removal.resolve",
        FIELD_UPLOAD,
        "schedule.read",
        "schedule.manage",
        "ovitrap.read",
        "reading.read",
        "relocation.read",
        "quadrant.read",
        *reader,
        REVIEW_ITEM_READ,
        REVIEW_ITEM_DECIDE,
        SHIFT_VALIDATE,
        SHIFT_READ,
        MOTORCYCLE_READ,
        MOTORCYCLE_UNBLOCK,
        MOTORCYCLE_SERVICE_CLEAR,
    }
    assert by_slug["entomologist"] == {
        "sample.read",
        "sample.receive",
        "sample.result_create",
        "recount.create",
        "bag.dispose",
        "bag.receive",
        "egg_count.create",
        "egg_count.read",
        "lab_rejection.create",
        "lab_method.read",
        FIELD_UPLOAD,
        "intervention.read",
        "intervention.create",
        "supply_type.read",
        "location.read",
        "lot.read",
        "condition.create",
        *reader,
        "reading.read",
        "schedule.read",
        "risk_import.apply",
    }
    assert by_slug["community_promoter"] == {
        *reader,
        "community_activity.read",
        "community_activity.create",
    }
    assert by_slug["warehouse"] == {
        "inventory.allocate",
        "inventory.reconcile",
        "inventory.write_off",
        "transfer.read",
        "transfer.create",
        "transfer.dispatch",
        "transfer.receive",
        "discrepancy.read",
        FIELD_UPLOAD,
        *reader,
        "supply_type.read",
        "supply_type.create",
        "supply_type.update",
        "location.read",
        "location.create",
        "location.update",
        "lot.read",
        "lot.create",
        "lot.update",
        "condition.create",
    }
    assert by_slug["coordinator"] == {
        "release.read",
        "training.read",
        "community_activity.read",
        "community_activity.void",
        "field.upload",
        "incident.read",
        "incident.create",
        "incident.close",
        "incident.reassign",
        "ovitrap.read",
        "reading.read",
        "relocation.read",
        *reader,
        "quadrant.read",
        "quadrant.publish",
        "sampling_point.create",
    }
    assert by_slug["regulatory"] == reader | {"permit.manage", "permit.suspend", "release.read"}
    assert by_slug["admin"] == {
        "sample.collect",
        "sample.void",
        "sample.read",
        "sample.receive",
        "sample.result_create",
        "notification.read",
        "notification_preference.update",
        "permit.manage",
        "permit.suspend",
        "release.read",
        "training.read",
        "training.manage",
        "evaluation.create",
        "evaluation.read",
        "recount.create",
        "recount.adjudicate",
        "egg_paddle.reuse",
        "community_activity.read",
        "community_activity.create",
        "community_activity.void",
        "inventory.allocate",
        "inventory.reconcile",
        "inventory.write_off",
        "supply_assignment.receive",
        "supply_assignment.reconcile",
        "bag.dispose",
        "bag.receive",
        "egg_count.create",
        "egg_count.read",
        "egg_count.void",
        "lab_rejection.create",
        "lab_method.read",
        "lab_method.manage",
        "lab_method.verify",
        "transfer.read",
        "transfer.create",
        "transfer.dispatch",
        "transfer.receive",
        "discrepancy.read",
        "discrepancy.close",
        "relocation.decide",
        "quadrant.close",
        "intervention.read",
        "intervention.create",
        "supply_type.read",
        "supply_type.create",
        "supply_type.update",
        "supply_type.deactivate",
        "location.read",
        "location.create",
        "location.update",
        "lot.read",
        "lot.create",
        "lot.update",
        "condition.create",
        "incident.read",
        "incident.create",
        "incident.close",
        "incident.reassign",
        "incident.manage_type",
        "removal.resolve",
        FIELD_UPLOAD,
        "schedule.read",
        "schedule.manage",
        "risk_import.apply",
        "ovitrap.read",
        "reading.read",
        "relocation.read",
        "quadrant.read",
        "quadrant.publish",
        "sampling_point.create",
        FIELD_EVENT_SYNC,
        FIELD_BOOTSTRAP,
        "portal.read",
        "organization.read",
        "organization.update",
        "role.read",
        "role.update",
        "center.read",
        catalog_codes.CATALOG_READ,
        catalog_codes.CATALOG_ITEM_CREATE,
        catalog_codes.CATALOG_ITEM_UPDATE,
        catalog_codes.CATALOG_ITEM_DEACTIVATE,
        catalog_codes.CATALOG_ITEM_ACTIVATE,
        rule_codes.RULE_PARAMETER_READ,
        rule_codes.RULE_PARAMETER_VERSION_READ,
        rule_codes.RULE_PARAMETER_VERSION_CREATE,
        rule_codes.RULE_PARAMETER_VERSION_VOID,
        *ADMIN_AUTH_PERMISSION_CODES,
        REVIEW_ITEM_READ,
        REVIEW_ITEM_DECIDE,
        SHIFT_VALIDATE,
        SHIFT_READ,
        MOTORCYCLE_READ,
        MOTORCYCLE_MANAGE,
        MOTORCYCLE_UNBLOCK,
        MOTORCYCLE_SERVICE_CLEAR,
    }


def test_only_admin_reads_the_version_history_by_default() -> None:
    organization = create_organization(SPEC)

    holders = [
        p.slug
        for p in Profile.objects.filter(organization=organization)
        if rule_codes.RULE_PARAMETER_VERSION_READ in p.permission_codes
    ]

    assert holders == ["admin"]


def test_default_permission_slugs_are_the_default_profile_slugs() -> None:
    assert set(DEFAULT_PROFILE_PERMISSIONS) == {seed.slug for seed in DEFAULT_PROFILE_SEEDS}


def test_seeded_codes_are_recorded_on_the_profile() -> None:
    organization = create_organization(SPEC)

    courier = Profile.objects.get(organization=organization, slug="courier")

    assert courier.created_by_seed is True
    assert courier.seeded_permission_codes == [
        "catalog.read",
        "center.read",
        "community_activity.create",
        "community_activity.read",
        "field.bootstrap",
        "field.upload",
        "field_event.sync",
        "incident.create",
        "incident.read",
        "motorcycle.read",
        "notification.read",
        "notification_preference.update",
        "organization.read",
        "rule_parameter.read",
        "sample.collect",
        "sample.void",
        "supply_assignment.receive",
        "supply_assignment.reconcile",
    ]


def test_seed_adds_permission_codes_without_removing_existing() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)
    Profile.objects.filter(organization=organization, slug="courier").update(
        permission_codes=["widget.read"]
    )

    seed_default_permission_codes(organization)

    courier = Profile.objects.get(organization=organization, slug="courier")
    assert courier.permission_codes == [
        "catalog.read",
        "center.read",
        "community_activity.create",
        "community_activity.read",
        "field.bootstrap",
        "field.upload",
        "field_event.sync",
        "incident.create",
        "incident.read",
        "motorcycle.read",
        "notification.read",
        "notification_preference.update",
        "organization.read",
        "rule_parameter.read",
        "sample.collect",
        "sample.void",
        "supply_assignment.receive",
        "supply_assignment.reconcile",
        "widget.read",
    ]


def test_seed_never_regrants_a_code_an_admin_revoked() -> None:
    organization = create_organization(SPEC)
    Profile.objects.filter(organization=organization, slug="courier").update(
        permission_codes=["catalog.read"]
    )
    administrator = Profile.objects.get(organization=organization, slug="admin")
    administrator.permission_codes.remove("evaluation.read")
    administrator.save(update_fields=["permission_codes"])

    seed_default_permission_codes(organization)

    courier = Profile.objects.get(organization=organization, slug="courier")
    assert courier.permission_codes == ["catalog.read"]
    administrator.refresh_from_db()
    assert "evaluation.read" not in administrator.permission_codes


def test_seed_grants_only_codes_never_seeded_before() -> None:
    organization = create_organization(SPEC)
    Profile.objects.filter(organization=organization, slug="courier").update(
        seeded_permission_codes=["catalog.read"], permission_codes=["catalog.read"]
    )

    plan = seed_default_permission_codes(organization)

    assert plan.grants == {
        "courier": (
            "sample.collect",
            "sample.void",
            "community_activity.read",
            "community_activity.create",
            "supply_assignment.receive",
            "supply_assignment.reconcile",
            "incident.read",
            "incident.create",
            "field.upload",
            "rule_parameter.read",
            "organization.read",
            "center.read",
            "notification.read",
            "notification_preference.update",
            FIELD_EVENT_SYNC,
            FIELD_BOOTSTRAP,
            MOTORCYCLE_READ,
        )
    }


def test_seed_skips_profiles_not_created_by_the_seed_and_reports_them() -> None:
    organization = OrganizationFactory()
    Profile.objects.create(organization=organization, slug="courier", label_es="C", label_en="C")

    plan = seed_default_permission_codes(organization)

    assert plan.skipped == ("courier",)
    assert Profile.objects.get(organization=organization, slug="courier").permission_codes == []


def test_seed_ignores_profiles_with_other_slugs() -> None:
    organization = OrganizationFactory()
    Profile.objects.create(
        organization=organization,
        slug="custom",
        label_es="C",
        label_en="C",
        created_by_seed=True,
    )

    plan = seed_default_permission_codes(organization)

    assert plan.skipped == ()
    assert Profile.objects.get(organization=organization, slug="custom").permission_codes == []


def run_command(*args: str) -> str:
    out = StringIO()
    call_command("seed_organization_defaults", *args, stdout=out)
    return out.getvalue()


def test_command_defaults_to_a_dry_run_that_writes_nothing() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)

    output = run_command("--organization", organization.slug)

    assert "Dry run" in output
    assert "grant to profile 'courier'" in output
    assert Catalog.objects.filter(organization=organization).count() == 0
    assert Profile.objects.get(organization=organization, slug="courier").permission_codes == []


def test_command_explicit_dry_run_writes_nothing() -> None:
    organization = OrganizationFactory()

    run_command("--organization", organization.slug, "--dry-run")

    assert Catalog.objects.filter(organization=organization).count() == 0


def test_command_apply_updates_an_existing_organization() -> None:
    organization = OrganizationFactory()
    seed_default_profiles(organization)

    output = run_command("--organization", organization.slug, "--apply")

    assert "Applied" in output
    assert Catalog.objects.filter(organization=organization).count() == 12
    assert RuleParameter.objects.filter(organization=organization).count() == len(
        DEFAULT_PARAMETER_SEEDS
    )
    courier = Profile.objects.get(organization=organization, slug="courier")
    assert "catalog.read" in courier.permission_codes


def test_command_reports_skipped_profiles_and_a_clean_organization() -> None:
    organization = OrganizationFactory()
    Profile.objects.create(organization=organization, slug="admin", label_es="A", label_en="A")

    assert "skip profile 'admin'" in run_command("--organization", organization.slug)

    clean = create_organization(SPEC)
    assert "nothing to do" in run_command("--organization", clean.slug)


def test_command_rejects_apply_with_dry_run() -> None:
    with pytest.raises(CommandError):
        call_command("seed_organization_defaults", "--organization", "x", "--apply", "--dry-run")


def test_command_rejects_an_unknown_organization() -> None:
    with pytest.raises(CommandError, match="does not exist"):
        call_command("seed_organization_defaults", "--organization", "nope")


# --- sync permission codes (#5) -------------------------------------------------------------


def seeded_profile(slug: str) -> tuple[Organization, Profile]:
    organization = create_organization(SPEC)
    return organization, Profile.objects.get(organization=organization, slug=slug)


@pytest.mark.parametrize(
    ("slug", "code"),
    [
        ("entomologist", FIELD_UPLOAD),
        ("supervisor", "egg_count.void"),
        ("courier", FIELD_UPLOAD),
        ("warehouse", FIELD_UPLOAD),
        ("supervisor", FIELD_UPLOAD),
        ("admin", FIELD_UPLOAD),
        ("courier", FIELD_EVENT_SYNC),
        ("admin", FIELD_EVENT_SYNC),
        ("supervisor", REVIEW_ITEM_READ),
        ("admin", REVIEW_ITEM_READ),
        ("admin", REVIEW_ITEM_DECIDE),
        ("supervisor", SHIFT_VALIDATE),
        ("supervisor", SHIFT_READ),
        ("admin", SHIFT_READ),
        ("courier", MOTORCYCLE_READ),
        ("supervisor", MOTORCYCLE_READ),
        ("supervisor", MOTORCYCLE_UNBLOCK),
        ("admin", MOTORCYCLE_MANAGE),
        ("admin", MOTORCYCLE_UNBLOCK),
        ("admin", "quadrant.publish"),
        ("coordinator", "sampling_point.create"),
        ("supervisor", "quadrant.read"),
        ("admin", "removal.resolve"),
        ("supervisor", "removal.resolve"),
    ],
)
def test_apply_grants_the_sync_codes_to_an_organization_seeded_before_they_existed(
    slug: str, code: str
) -> None:
    organization, profile = seeded_profile(slug)
    Profile.objects.filter(pk=profile.pk).update(
        permission_codes=[c for c in profile.permission_codes if c != code],
        seeded_permission_codes=[c for c in profile.seeded_permission_codes if c != code],
    )

    call_command("seed_organization_defaults", organization=organization.slug, apply=True)

    profile.refresh_from_db()
    assert code in profile.permission_codes
    assert code in profile.seeded_permission_codes


def test_inventory_seed_keeps_warehouse_revocation_custom_profile_and_government_boundary():
    organization = create_organization(SPEC)
    warehouse = Profile.objects.get(organization=organization, slug="warehouse")
    warehouse.permission_codes = [
        code
        for code in warehouse.permission_codes
        if code not in ("lot.update", "inventory.allocate", FIELD_UPLOAD)
    ]
    warehouse.save(update_fields=["permission_codes"])
    entomologist = Profile.objects.get(organization=organization, slug="entomologist")
    entomologist.permission_codes.remove("recount.create")
    entomologist.save(update_fields=["permission_codes"])
    admin = Profile.objects.get(organization=organization, slug="admin")
    admin.permission_codes.remove("recount.adjudicate")
    admin.save(update_fields=["permission_codes"])
    custom = Profile.objects.create(
        organization=organization,
        slug="custom-inventory",
        label_es="Prueba",
        label_en="Synthetic",
        permission_codes=["lot.read"],
    )
    seed_default_permission_codes(organization)
    warehouse.refresh_from_db()
    custom.refresh_from_db()
    entomologist.refresh_from_db()
    admin.refresh_from_db()
    assert "recount.create" not in entomologist.permission_codes
    assert not {"recount.adjudicate", "egg_paddle.reuse"} & set(entomologist.permission_codes)
    assert "recount.adjudicate" not in admin.permission_codes
    assert "egg_paddle.reuse" in admin.permission_codes
    assert "lot.update" not in warehouse.permission_codes
    assert "inventory.allocate" not in warehouse.permission_codes
    assert FIELD_UPLOAD not in warehouse.permission_codes
    assert "supply_type.deactivate" not in warehouse.permission_codes
    assert custom.permission_codes == ["lot.read"]
    assert Profile.objects.get(organization=organization, slug="government").permission_codes == [
        "portal.read"
    ]


@pytest.mark.parametrize(
    ("slug", "code"),
    [
        ("entomologist", FIELD_UPLOAD),
        ("supervisor", "egg_count.void"),
        ("courier", FIELD_UPLOAD),
        ("supervisor", FIELD_UPLOAD),
        ("admin", FIELD_UPLOAD),
        ("courier", FIELD_EVENT_SYNC),
        ("admin", FIELD_EVENT_SYNC),
        ("supervisor", REVIEW_ITEM_READ),
        ("supervisor", SHIFT_READ),
        ("admin", REVIEW_ITEM_DECIDE),
        ("supervisor", SHIFT_VALIDATE),
        ("courier", MOTORCYCLE_READ),
        ("admin", MOTORCYCLE_MANAGE),
        ("admin", MOTORCYCLE_UNBLOCK),
        ("admin", "quadrant.publish"),
        ("coordinator", "sampling_point.create"),
        ("supervisor", "quadrant.read"),
        ("admin", "removal.resolve"),
        ("supervisor", "removal.resolve"),
    ],
)
def test_a_sync_code_an_admin_revoked_is_not_granted_again(slug: str, code: str) -> None:
    organization, profile = seeded_profile(slug)
    Profile.objects.filter(pk=profile.pk).update(
        permission_codes=[c for c in profile.permission_codes if c != code]
    )

    call_command("seed_organization_defaults", organization=organization.slug, apply=True)

    profile.refresh_from_db()
    assert code not in profile.permission_codes
    assert code in profile.seeded_permission_codes


def test_only_courier_and_admin_sync_and_only_supervisor_and_admin_read_review_items() -> None:
    by_slug = DEFAULT_PROFILE_PERMISSIONS

    assert sorted(s for s, codes in by_slug.items() if FIELD_EVENT_SYNC in codes) == [
        "admin",
        "courier",
    ]
    assert sorted(s for s, codes in by_slug.items() if REVIEW_ITEM_READ in codes) == [
        "admin",
        "supervisor",
    ]


def test_only_supervisor_and_admin_read_shifts_by_default() -> None:
    by_slug = DEFAULT_PROFILE_PERMISSIONS

    assert sorted(s for s, codes in by_slug.items() if SHIFT_READ in codes) == [
        "admin",
        "supervisor",
    ]
