"""B-08 safety/traceability criteria, once at the cheapest meaningful layer."""

from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from inventory.policy import (
    LotSafetySnapshot,
    Protocol,
    assess_condition,
    evaluate_lot,
    reading_slot,
    validate_piece_quantity,
)

NOW = datetime(2026, 11, 6, 18, tzinfo=UTC)
PROTOCOL = Protocol(
    name="synthetic-test-protocol",
    temperature_min=Decimal("10"),
    temperature_max=Decimal("20"),
    humidity_min=Decimal("30"),
    humidity_max=Decimal("40"),
    windows=((0, 720), (720, 1440)),
)
READY = LotSafetySnapshot(
    is_biological=True,
    is_active=True,
    missing_fields=(),
    expires_at=datetime(2026, 11, 7, tzinfo=UTC),
    protocol_ready=True,
    requires_insecticide_free=True,
    is_insecticide_free=True,
    slots=frozenset({0, 1}),
    unresolved_breaches=(),
)


@pytest.mark.parametrize(
    ("changes", "status", "reason"),
    [
        ({"missing_fields": ("species",)}, "draft", "species"),
        ({"protocol_ready": False}, "blocked", "protocol_not_configured"),
        ({"expires_at": NOW}, "blocked", "lot_expired"),
        ({"slots": frozenset({0})}, "blocked", "condition_slot_missing"),
        ({"is_insecticide_free": None}, "blocked", "insecticide_free_required"),
        ({"is_insecticide_free": False}, "blocked", "insecticide_free_required"),
        ({"requires_insecticide_free": None}, "blocked", "storage_safety_not_configured"),
        ({"is_active": False}, "blocked", "supply_type_inactive"),
        ({"unresolved_breaches": ("breach-1",)}, "blocked", "condition_breach"),
    ],
)
def test_lot_safety_requires_explicit_complete_unexpired_facts(changes, status, reason):
    safety = evaluate_lot(replace(READY, **changes), NOW)
    assert safety.status == status
    assert reason in (*safety.missing_fields, *safety.blocked_by)


def test_both_current_local_slots_are_required_even_before_second_window():
    early = NOW.replace(hour=3)
    safety = evaluate_lot(replace(READY, slots=frozenset({0})), early)
    assert safety.status == "blocked"
    assert safety.blocked_by == ("condition_slot_missing",)


@pytest.mark.parametrize(
    ("temperature", "humidity", "expected"),
    [("10", "30", "normal"), ("20", "40", "normal"), ("20.01", "40", "breach")],
)
def test_condition_range_boundaries_are_inclusive(temperature, humidity, expected):
    assert assess_condition(PROTOCOL, Decimal(temperature), Decimal(humidity)) == expected


def test_missing_named_range_is_unassessed_and_never_a_normal_reading():
    assert (
        assess_condition(replace(PROTOCOL, name=""), Decimal("15"), Decimal("35")) == "unassessed"
    )
    assert (
        assess_condition(replace(PROTOCOL, humidity_max=None), Decimal("15"), Decimal("35"))
        == "unassessed"
    )


def test_local_windows_do_not_count_two_readings_in_same_slot_as_a_complete_day():
    first = datetime(2026, 11, 6, 12, tzinfo=UTC)
    second = first.replace(hour=13)
    slots = {reading_slot(PROTOCOL, at, "America/Mexico_City")[1] for at in (first, second)}
    assert slots == {0}
    assert reading_slot(PROTOCOL, NOW, "America/Mexico_City")[1] == 1


def test_dst_fold_retains_one_local_window_and_correct_local_date():
    first = datetime(2026, 11, 1, 5, 30, tzinfo=UTC)
    second = first.replace(hour=6)
    assert reading_slot(PROTOCOL, first, "America/New_York") == reading_slot(
        PROTOCOL, second, "America/New_York"
    )


@pytest.mark.parametrize(
    ("laid_on", "duration_end", "calendar_end"),
    [
        (
            date(2026, 3, 8),
            datetime(2026, 3, 9, 5, tzinfo=UTC),
            datetime(2026, 3, 9, 4, tzinfo=UTC),
        ),
        (
            date(2026, 11, 1),
            datetime(2026, 11, 2, 4, tzinfo=UTC),
            datetime(2026, 11, 2, 5, tzinfo=UTC),
        ),
    ],
)
def test_protocol_seconds_and_expiry_date_keep_distinct_dst_semantics(
    laid_on, duration_end, calendar_end
):
    from inventory.services import _resolve_expiry

    duration = {
        "timezone": "America/New_York",
        "laid_on": laid_on,
        "protocol": SimpleNamespace(shelf_life_seconds=86400, expiry_basis="laid_on"),
    }
    _resolve_expiry(duration)
    assert duration["expires_at"] == duration_end
    calendar = {"timezone": "America/New_York", "expiry_date": laid_on, "protocol": None}
    _resolve_expiry(calendar)
    assert calendar["expires_at"] == calendar_end


@pytest.mark.django_db
def test_winning_locked_timezone_pins_new_facts_without_rewriting_history(
    org_a, make_member, monkeypatch
):
    from inventory.conditions import record_condition
    from inventory.services import LotChange, revise_lot
    from organizations.models import Organization
    from tests.inventory_support import biological_context, capture

    context = biological_context(org_a, make_member, monkeypatch, configured=False)
    request = capture(context, NOW.replace(hour=3), "15", "35")
    original = record_condition(request)
    original_expiry = context.version.expires_at
    Organization.objects.filter(pk=org_a.pk).update(timezone="UTC")
    revised = revise_lot(
        LotChange(
            context.actor,
            {"expiry_date": NOW.date()},
            context.lot.pk,
            context.version.revision,
        )
    )
    assert revised.timezone == "UTC"
    assert revised.expires_at == datetime(2026, 11, 7, tzinfo=UTC)
    reading = record_condition(capture(context, NOW.replace(hour=3, minute=1), "15", "35"))
    assert (reading.local_date, reading.slot, reading.timezone) == (NOW.date(), 0, "UTC")
    assert context.actor.organization.timezone == "America/Mexico_City"
    assert record_condition(request).pk == original.pk
    original.refresh_from_db()
    context.version.refresh_from_db()
    assert (original.local_date, original.slot, original.timezone) == (
        date(2026, 11, 5),
        1,
        "America/Mexico_City",
    )
    assert context.version.timezone == "America/Mexico_City"
    assert context.version.expires_at == original_expiry


@pytest.mark.parametrize("quantity", [Decimal("0"), Decimal("1.5"), Decimal("10001")])
def test_piece_admission_rejects_nonintegral_or_oversized_identity_expansion(quantity):
    with pytest.raises(ValueError, match="Piece quantity"):
        validate_piece_quantity(quantity)


def test_piece_cap_is_a_technical_bound_and_preserves_decimal_integrality():
    assert validate_piece_quantity(Decimal("10000.000000")) == 10000


@pytest.mark.parametrize(
    ("kind", "allowed"), [("supply", True), ("location", False), ("unknown", False)]
)
def test_only_known_org_masters_can_omit_applicable_storage_axes(kind, allowed, monkeypatch):
    from django.http import Http404

    from accounts.models import User
    from inventory.access import require_scope
    from inventory.models import Location, Piece, SupplyType
    from organizations.models import Organization, all_scope
    from organizations.scope import EffectiveScope, deny_scope
    from uploads.access import UploadActor

    organization = Organization()
    actor = UploadActor(User(), organization)
    dimensions = deny_scope() if kind == "supply" else all_scope()
    scope = EffectiveScope(((frozenset({"supply_type.read", "location.read"}), dimensions),))
    monkeypatch.setattr("inventory.access.current_scope", lambda candidate: scope)
    resource = {"supply": SupplyType, "location": Location, "unknown": Piece}[kind](
        organization=organization
    )
    permission = "supply_type.read" if kind == "supply" else "location.read"
    if allowed:
        require_scope(actor, permission, resource)
    else:
        with pytest.raises(Http404):
            require_scope(actor, permission, resource)


@pytest.mark.django_db
def test_http_org_masters_and_storage_keep_default_none_and_explicit_all_distinct(
    org_a, make_member, api_client
):
    from inventory.permissions import ADMIN_CODES
    from tests.inventory_support import allow_all, inventory_context

    context = inventory_context(org_a, make_member)
    user, default_none = make_member(org_a, ADMIN_CODES)
    api_client.force_authenticate(user)
    supply_path = f"/api/v1/supply-types/{context.supply.pk}/"
    assert (
        api_client.get("/api/v1/supply-types/", {"code": context.supply.code}).json()["count"] == 1
    )
    assert api_client.get(supply_path).status_code == 200
    assert (
        api_client.patch(
            supply_path,
            {"expected_revision": 1, "label": "Organization master with no assigned storage"},
            format="json",
        ).status_code
        == 200
    )
    assert (
        api_client.post(
            "/api/v1/supply-types/",
            {
                "code": "ORG-ONLY",
                "label": "Synthetic organization master",
                "unit": "piece",
                "identity_kind": "lot",
                "is_biological": False,
                "expiry_required": False,
            },
            format="json",
        ).status_code
        == 201
    )
    assert api_client.get("/api/v1/locations/").json()["count"] == 0
    assert api_client.get(f"/api/v1/locations/{context.location.pk}/").status_code == 404
    assert api_client.get("/api/v1/lots/").json()["count"] == 0
    assert api_client.get(f"/api/v1/lots/{context.lot.pk}/").status_code == 404
    assert (
        api_client.patch(
            f"/api/v1/locations/{context.location.pk}/",
            {"expected_revision": 1, "name": "Denied unknown storage"},
            format="json",
        ).status_code
        == 404
    )
    assert (
        api_client.patch(
            f"/api/v1/lots/{context.lot.pk}/",
            {"expected_revision": 1, "observations": "Denied unknown storage"},
            format="json",
        ).status_code
        == 404
    )
    for code in ("UNASSIGNED-NEW", context.location.code):
        assert (
            api_client.post(
                "/api/v1/locations/",
                {
                    "code": code,
                    "center_id": str(context.center.pk),
                    "name": "Synthetic store",
                    "owner_id": str(context.member.pk),
                    "kind": "warehouse",
                    "geometry": {"type": "Point", "coordinates": [-99, 19]},
                },
                format="json",
            ).status_code
            == 404
        )
    for code in ("UNASSIGNED-LOT", context.lot.code):
        assert (
            api_client.post(
                "/api/v1/lots/",
                {
                    "code": code,
                    "supply_id": str(context.supply.pk),
                    "initial_location_id": str(context.location.pk),
                },
                format="json",
            ).status_code
            == 404
        )
    allow_all(default_none)
    assert api_client.get("/api/v1/locations/").json()["count"] == 1
    assert api_client.get("/api/v1/lots/").json()["count"] == 1
    assert api_client.get(f"/api/v1/locations/{context.location.pk}/").status_code == 200
    assert api_client.get(f"/api/v1/lots/{context.lot.pk}/").status_code == 200
    assert (
        api_client.patch(
            f"/api/v1/locations/{context.location.pk}/",
            {"expected_revision": 1, "name": "Explicitly assigned storage"},
            format="json",
        ).status_code
        == 200
    )
    assert (
        api_client.patch(
            f"/api/v1/lots/{context.lot.pk}/",
            {"expected_revision": 1, "observations": "Explicitly assigned storage"},
            format="json",
        ).status_code
        == 200
    )


@pytest.mark.django_db
def test_http_master_draft_revision_and_deactivate_wiring_preserves_history(
    org_a, make_member, api_client
):
    from inventory.models import LotAdmission, SupplyTypeVersion
    from tests.inventory_support import inventory_context

    context = inventory_context(org_a, make_member)
    api_client.force_authenticate(context.actor.user)
    supply = api_client.post(
        "/api/v1/supply-types/",
        {
            "code": "HTTP-SUPPLY",
            "label": "Synthetic HTTP supply",
            "unit": "piece",
            "identity_kind": "lot",
            "is_biological": False,
            "expiry_required": False,
        },
        format="json",
    )
    assert supply.status_code == 201
    supply_id = supply.json()["id"]
    location = api_client.post(
        "/api/v1/locations/",
        {
            "code": "HTTP-STORE",
            "center_id": str(context.center.pk),
            "owner_id": str(context.member.pk),
            "name": "Synthetic HTTP store",
            "kind": "warehouse",
            "geometry": {"type": "Point", "coordinates": [-99, 19]},
        },
        format="json",
    )
    assert location.status_code == 201
    lot = api_client.post(
        "/api/v1/lots/",
        {
            "code": "HTTP-DRAFT",
            "supply_id": supply_id,
            "initial_location_id": location.json()["id"],
        },
        format="json",
    )
    assert lot.status_code == 201
    assert lot.json()["status"] == "draft"
    revised = api_client.patch(
        f"/api/v1/lots/{lot.json()['id']}/",
        {"expected_revision": 1, "quantity": "3", "provenance": "Synthetic HTTP admission"},
        format="json",
    )
    assert revised.status_code == 200
    assert revised.json()["status"] == "available"
    assert LotAdmission.objects.filter(lot_id=lot.json()["id"]).count() == 1
    for _ in range(2):
        inactive = api_client.post(
            f"/api/v1/supply-types/{supply_id}/deactivate/", {"expected_revision": 1}, format="json"
        )
        assert inactive.status_code == 200
        assert inactive.json()["is_active"] is False
    assert SupplyTypeVersion.objects.filter(supply_type_id=supply_id).count() == 2
    detail = api_client.get(f"/api/v1/lots/{lot.json()['id']}/")
    assert detail.json()["status"] == "blocked"
    assert api_client.delete(f"/api/v1/lots/{lot.json()['id']}/").status_code == 405


@pytest.mark.django_db
def test_inventory_admission_and_revision_preserve_ledger_and_provenance(org_a, make_member):
    from inventory.models import LotAdmission, Piece, StockMovement
    from inventory.selectors import location_stock
    from inventory.services import LotChange, revise_lot
    from tests.inventory_support import inventory_context

    context = inventory_context(org_a, make_member, identity_kind="piece", quantity="2")
    assert LotAdmission.objects.filter(lot=context.lot).count() == 1
    assert Piece.objects.filter(lot=context.lot).count() == 2
    assert sum(row["quantity"] for row in location_stock(context.actor, context.location)) == 2
    original = context.version
    current = revise_lot(
        LotChange(context.actor, {"observations": "retained correction"}, context.lot.pk, 1)
    )
    assert current.revision == 2
    original.refresh_from_db()
    assert original.observations == ""
    assert StockMovement.objects.filter(lot=context.lot).count() == 2


@pytest.mark.django_db
def test_breached_reading_retry_retains_one_owned_incident_and_normal_does_not_clear(
    org_a, make_member, monkeypatch
):
    from inventory.conditions import record_condition
    from inventory.models import ConditionBreach, ConditionIncidentLink
    from tests.inventory_support import biological_context, capture

    context = biological_context(org_a, make_member, monkeypatch)
    request = capture(context, NOW, "21", "35")
    reading = record_condition(request)
    replay = record_condition(request)
    assert replay.pk == reading.pk
    assert ConditionBreach.objects.filter(reading=reading).count() == 1
    assert ConditionIncidentLink.objects.filter(breach__reading=reading).count() == 1
    normal = record_condition(capture(context, NOW.replace(minute=1), "15", "35"))
    assert normal.evaluation == "normal"
    assert context.safety().status == "blocked"


@pytest.mark.django_db
def test_authorized_close_clears_only_its_breach_and_keeps_other_safety_gates(
    org_a, make_member, monkeypatch
):
    from incidents.services import Decision, decide
    from inventory.conditions import record_condition
    from inventory.models import ConditionIncidentLink
    from tests.inventory_support import biological_context, capture
    from tests.uploads_support import verified_upload

    context = biological_context(org_a, make_member, monkeypatch)
    first = record_condition(capture(context, NOW, "21", "35"))
    second = record_condition(capture(context, NOW.replace(minute=1), "22", "35"))
    record_condition(capture(context, NOW.replace(hour=12), "15", "35"))
    first_case = ConditionIncidentLink.objects.get(breach__reading=first).incident
    second_case = ConditionIncidentLink.objects.get(breach__reading=second).incident
    for incident, expected in ((first_case, "blocked"), (second_case, "available")):
        upload = verified_upload(org_a, context.actor.user)
        decide(
            context.actor,
            incident.pk,
            Decision("close", 1, "Resolved synthetic storage condition", (upload.public_id,)),
        )
        assert context.safety().status == expected


@pytest.mark.django_db
def test_missing_incident_configuration_retains_measurement_and_recovers_source_once(
    org_a, make_member, monkeypatch
):
    from inventory.conditions import reconcile_condition_incident, record_condition
    from inventory.models import ConditionBreach, ConditionIncidentLink
    from tests.inventory_support import biological_context, capture, configure_incident

    context = biological_context(org_a, make_member, monkeypatch, configured=False)
    reading = record_condition(capture(context, NOW, "21", "35"))
    breach = ConditionBreach.objects.get(reading=reading)
    assert reconcile_condition_incident(breach) is None
    assert context.safety().status == "blocked"
    pinned_protocol = reading.protocol_id
    configure_incident(context)
    first = reconcile_condition_incident(breach)
    second = reconcile_condition_incident(breach)
    assert first.pk == second.pk
    assert ConditionIncidentLink.objects.filter(breach=breach).count() == 1
    reading.refresh_from_db()
    assert reading.protocol_id == pinned_protocol
    assert reading.server_received_at == NOW.replace(hour=19)


@pytest.mark.django_db
def test_range_revision_never_reassesses_an_original_reading(org_a, make_member, monkeypatch):
    from inventory.conditions import record_condition
    from inventory.masters import MasterChange, revise_supply_type
    from inventory.services import LotChange, revise_lot
    from tests.inventory_support import biological_context, capture

    context = biological_context(org_a, make_member, monkeypatch)
    original = record_condition(capture(context, NOW, "21", "35"))
    old_protocol = original.protocol_id
    revised_supply = revise_supply_type(
        MasterChange(
            context.actor,
            {"protocol": {"temperature_max": Decimal("25")}},
            context.supply.pk,
            context.supply_version.revision,
        )
    )
    unrelated = revise_lot(
        LotChange(
            context.actor,
            {"observations": "Unrelated authored detail revision"},
            context.lot.pk,
            context.version.revision,
        )
    )
    assert unrelated.protocol_id == old_protocol
    revise_lot(
        LotChange(
            context.actor,
            {"supply_version_id": revised_supply.pk},
            context.lot.pk,
            unrelated.revision,
        )
    )
    new = record_condition(capture(context, NOW.replace(minute=1), "21", "35"))
    assert new.evaluation == "normal"
    original.refresh_from_db()
    assert original.evaluation == "breach"
    assert original.protocol_id == old_protocol
    assert original.protocol_id != new.protocol_id


@pytest.mark.django_db
def test_incomplete_biological_draft_keeps_quantity_provisional_and_cannot_dispatch(
    org_a, make_member, monkeypatch
):
    from inventory.exceptions import InventoryConflictError
    from inventory.models import LotAdmission
    from inventory.services import LotChange, require_dispatchable, revise_lot
    from inventory.transactions import inventory_transaction
    from tests.inventory_support import biological_context

    context = biological_context(org_a, make_member, monkeypatch)
    values = {
        "code": "DRAFT-BIO",
        "supply_id": context.supply.pk,
        "initial_location_id": context.location.pk,
        "quantity": Decimal("2"),
        "provenance": "Synthetic incomplete receipt",
    }
    draft = revise_lot(LotChange(context.actor, values))
    assert not LotAdmission.objects.filter(lot=draft.lot).exists()
    with (
        inventory_transaction(context.actor),
        pytest.raises(InventoryConflictError, match="conflicts"),
    ):
        require_dispatchable(draft.lot, context.actor)


@pytest.mark.django_db
def test_post_admission_quantity_edit_is_refused_without_movement_compensation(org_a, make_member):
    from inventory.exceptions import InventoryConflictError
    from inventory.models import StockMovement
    from inventory.services import LotChange, revise_lot
    from tests.inventory_support import inventory_context

    context = inventory_context(org_a, make_member)
    before = list(StockMovement.objects.filter(lot=context.lot).values("id", "quantity"))
    with pytest.raises(InventoryConflictError, match="conflicts"):
        revise_lot(LotChange(context.actor, {"quantity": Decimal("4")}, context.lot.pk, 1))
    assert list(StockMovement.objects.filter(lot=context.lot).values("id", "quantity")) == before
    assert context.lot.versions.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("field", ["balance", "status", "blocked_by"])
def test_http_cannot_write_operational_stock_or_status(org_a, make_member, api_client, field):
    from inventory.models import StockMovement
    from tests.inventory_support import inventory_context

    context = inventory_context(org_a, make_member)
    api_client.force_authenticate(context.actor.user)
    response = api_client.patch(
        f"/api/v1/lots/{context.lot.pk}/", {"expected_revision": 1, field: 99}, format="json"
    )
    assert response.status_code == 400
    assert response.json()["fields"][field][0]["code"] == "unknown_field"
    assert StockMovement.objects.filter(lot=context.lot).count() == 1


@pytest.mark.django_db
def test_http_default_deny_and_foreign_org_center_quadrant_use_one_scoped_contract(
    org_a, org_b, make_member, api_client
):
    from uuid import uuid4

    from geography.models import Quadrant
    from organizations.models import Center, all_scope
    from tests.factories import ProfileFactory
    from tests.inventory_support import inventory_context

    first = inventory_context(org_a, make_member)
    second_center = Center.objects.create(
        organization=org_a,
        created_by=first.actor.user,
        code="C-SCOPED",
        name="Synthetic second center",
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=first.actor.user, code="Q-SCOPED", center=second_center
    )
    scoped = inventory_context(org_a, make_member, quadrant=quadrant)
    foreign = inventory_context(org_b, make_member)
    api_client.force_authenticate(first.actor.user)
    assert (
        api_client.patch(
            f"/api/v1/lots/{first.lot.pk}/",
            {"expected_revision": 1, "supply_id": str(foreign.supply.pk)},
            format="json",
        ).status_code
        == 404
    )
    assert (
        api_client.patch(
            f"/api/v1/locations/{first.location.pk}/",
            {"expected_revision": 1, "center_id": str(foreign.center.pk)},
            format="json",
        ).status_code
        == 404
    )
    first.profile.permission_codes = []
    first.profile.save(update_fields=["permission_codes"])
    assert api_client.get("/api/v1/lots/").status_code == 403
    first.profile.permission_codes = ["lot.read"]
    first.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(first.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    first.profile.save(update_fields=["permission_codes", "scope"])
    unrelated = ProfileFactory(
        organization=org_a, permission_codes=["location.read"], scope=all_scope()
    )
    first.member.profiles.add(unrelated)
    for identifier in (scoped.lot.pk, foreign.lot.pk, uuid4()):
        assert api_client.get(f"/api/v1/lots/{identifier}/").status_code == 404
    assert api_client.get(f"/api/v1/lots/{first.lot.pk}/").status_code == 200
    assert api_client.get(f"/api/v1/lots/?location={foreign.location.pk}").status_code == 404
    first.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(second_center.pk)]},
        "quadrants": {"mode": "selected", "ids": []},
    }
    first.profile.save(update_fields=["scope"])
    assert api_client.get(f"/api/v1/lots/{scoped.lot.pk}/").status_code == 404
    first.profile.scope["quadrants"]["ids"] = [str(quadrant.pk)]
    first.profile.save(update_fields=["scope"])
    assert api_client.get(f"/api/v1/lots/{scoped.lot.pk}/").status_code == 200


@pytest.mark.django_db
def test_server_status_code_and_stock_filters_precede_paging(
    org_a, make_member, api_client, monkeypatch
):
    from tests.inventory_support import biological_context, inventory_context

    available = inventory_context(org_a, make_member, identity_kind="piece", quantity="2")
    blocked = biological_context(org_a, make_member, monkeypatch, configured=False)
    api_client.force_authenticate(available.actor.user)
    response = api_client.get(
        "/api/v1/lots/", {"status": "blocked", "page_size": 1, "ordering": "-expiry"}
    )
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["id"] == str(blocked.lot.pk)
    exact = api_client.get("/api/v1/lots/", {"code": available.lot.code})
    assert exact.json()["count"] == 1
    stock = api_client.get(
        f"/api/v1/locations/{available.location.pk}/stock/",
        {"lot": available.lot.pk, "page_size": 1},
    )
    assert stock.status_code == 200
    assert stock.json()["count"] == 2
    assert len(stock.json()["results"][0]["source_ids"]) == 1


@pytest.mark.django_db
@pytest.mark.parametrize("table", ["inventory_supplytypeversion", "inventory_stockmovement"])
@pytest.mark.parametrize("operation", ["UPDATE", "DELETE"])
def test_raw_sql_cannot_rewrite_or_delete_inventory_facts(org_a, make_member, table, operation):
    from django.db import DatabaseError, connection, transaction

    from inventory.models import StockMovement
    from tests.inventory_support import inventory_context

    context = inventory_context(org_a, make_member)
    identifier = (
        context.supply_version.pk
        if table.endswith("supplytypeversion")
        else StockMovement.objects.get(lot=context.lot).pk
    )
    clause = "SET created_at=created_at" if operation == "UPDATE" else ""
    with (
        pytest.raises(DatabaseError, match="insert-only"),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute(
            f"{operation} {'FROM ' if operation == 'DELETE' else ''}{table} {clause} WHERE id=%s",
            [identifier],
        )
