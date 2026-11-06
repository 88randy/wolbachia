"""#270 read contracts: real provenance, exact pins and pre-page authority."""

import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import JSONField, Value
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from accounts.models import User
from catalogs.services import deactivate_catalog_item
from geography.models import Quadrant
from incidents.configuration import write_type
from inventory.conditions import record_condition
from inventory.masters import (
    MasterChange,
    deactivate_supply_type,
    revise_location,
    revise_supply_type,
)
from inventory.option_selectors import (
    Placement,
    eligible_location_owners,
    owner_options,
    placement_options,
)
from inventory.selectors import (
    current_lot,
    location_movements,
    location_stock,
    lot_safety,
    lot_versions,
)
from inventory.serializers import InventoryQuerySerializer, LotSerializer, MovementSerializer
from inventory.services import LotChange, revise_lot
from inventory.table_filters import InventoryTableFilter, filter_movements
from organizations.models import Center, Membership, Profile, all_scope, default_scope
from organizations.services import effective_scope
from tests.factories import ProfileFactory
from tests.inventory_support import AT, allow_all, capture, configure_incident, inventory_context
from uploads.access import UploadActor


def test_authenticated_schema_metadata_does_not_require_inventory_option_targets(api_client):
    api_client.force_authenticate(User(pk=uuid4(), username="synthetic-schema-reader"))
    with patch.object(
        BaseDatabaseWrapper,
        "ensure_connection",
        side_effect=AssertionError("Database connection forbidden"),
    ) as connection_guard:
        response = api_client.get("/api/v1/schema/", {"format": "json"})
    assert response.status_code == 200
    assert {
        "/api/v1/me/",
        "/api/v1/locations/owner-options/",
        "/api/v1/locations/placement-options/",
        "/api/v1/supply-types/protocol-incident-type-options/",
    } <= response.json()["paths"].keys()
    connection_guard.assert_not_called()


def test_expiry_calendar_bounds_use_local_midnight_and_refuse_ambiguous_ranges():
    query = InventoryQuerySerializer(
        data={"expiry_from_date": "2026-03-08", "expiry_before_date": "2026-03-09"},
        context={"timezone": "America/New_York"},
    )
    assert query.is_valid(), query.errors
    assert query.validated_data["expiry_from"] == datetime(2026, 3, 8, 5, tzinfo=UTC)
    assert query.validated_data["expiry_before"] == datetime(2026, 3, 9, 4, tzinfo=UTC)
    for values in (
        {"expiry_from_date": "2026-03-09", "expiry_before_date": "2026-03-08"},
        {"expiry_from_date": "2026-03-08", "expiry_from": "2026-03-08T05:00:00Z"},
        {"expiry_before_date": "2026-03-09", "expiry_before": "2026-03-09T04:00:00Z"},
    ):
        invalid = InventoryQuerySerializer(data=values, context={"timezone": "America/New_York"})
        assert not invalid.is_valid()


def selected(center, quadrant=None):
    return {
        "centers": {"mode": "selected", "ids": [str(center)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant)] if quadrant else []},
    }


def set_raw_scope(record, raw):
    record.__class__.objects.filter(pk=record.pk).update(scope=Value(raw, JSONField()))
    record.refresh_from_db()


@pytest.mark.django_db
def test_owner_sql_matches_whole_scope_normalizer_and_same_binding_government_clamp(
    org_a, org_b, make_member
):
    context = inventory_context(org_a, make_member)
    quadrant = Quadrant.objects.create(organization=org_a, center=context.center, code="OWNER-Q")
    pair = selected(context.center.pk, quadrant.pk)
    upper = deepcopy(pair)
    upper["centers"]["ids"] = [str(context.center.pk).upper()]
    upper["quadrants"]["ids"] = ["{" + str(quadrant.pk) + "}"]
    urn = deepcopy(pair)
    urn["centers"]["ids"] = [context.center.pk.urn]
    duplicate = deepcopy(pair)
    duplicate["quadrants"]["ids"] *= 2
    malformed_axis = deepcopy(pair)
    malformed_axis["quadrants"] = {"mode": "none", "ids": [str(quadrant.pk)]}
    raw_cases = [
        None,
        [],
        {},
        default_scope(),
        all_scope(),
        {"centers": {"mode": "selected", "ids": []}, "quadrants": {"mode": "all", "ids": []}},
        pair,
        upper,
        urn,
        duplicate,
        malformed_axis,
        selected(uuid4(), quadrant.pk),
    ]
    members = [context.member]
    for raw in raw_cases:
        for axis in ("member", "profile"):
            _, member = make_member(org_a, ["location.read"])
            allow_all(member)
            set_raw_scope(member if axis == "member" else member.profiles.get(), raw)
            members.append(member)
    _, crossed = make_member(org_a, ["location.read"])
    allow_all(crossed)
    set_raw_scope(crossed.profiles.get(), selected(uuid4(), quadrant.pk))
    crossed.profiles.add(
        ProfileFactory(organization=org_a, scope=pair, permission_codes=["location.update"])
    )
    members.append(crossed)
    _, government = make_member(org_a, ["location.read"])
    allow_all(government)
    government.profiles.add(
        ProfileFactory(organization=org_a, slug="government", scope=default_scope())
    )
    members.append(government)
    _, foreign_binding = make_member(org_a, [])
    allow_all(foreign_binding)
    foreign_binding.profiles.add(
        ProfileFactory(organization=org_b, scope=all_scope(), permission_codes=["location.read"])
    )
    members.append(foreign_binding)
    for inactive_axis in ("member", "profile", "user"):
        user, member = make_member(org_a, ["location.read"])
        allow_all(member)
        record = {"member": member, "profile": member.profiles.get(), "user": user}[inactive_axis]
        record.is_active = False
        record.save(update_fields=["is_active"])
        members.append(member)
    for quadrant_id in (quadrant.pk, None):
        placement = Placement(context.center, quadrant_id)
        expected = {
            member.pk
            for member in members
            if effective_scope(member).allows(
                "location.read", str(context.center.pk), str(quadrant_id) if quadrant_id else None
            )
        }
        assert (
            set(eligible_location_owners(context.actor, placement).values_list("pk", flat=True))
            == expected
        )


@pytest.mark.django_db
def test_owner_eligibility_is_applied_before_label_count_and_pages(org_a, make_member):
    context = inventory_context(org_a, make_member)
    expected = []
    for index in range(6):
        user, member = make_member(org_a, ["location.read"])
        user.first_name = "Option duplicate" if index in (2, 4) else f"Option {index}"
        user.save(update_fields=["first_name"])
        if index % 2 == 0:
            allow_all(member)
            label = f"Option duplicate ({user.username})" if index in (2, 4) else user.first_name
            expected.append((label, member.pk))
    query = owner_options(
        context.actor, {"center": context.center.pk, "quadrant": None, "search": "Option"}
    )
    assert query.count() == 3
    assert list(query.values_list("label", "pk")[1:3]) == sorted(expected)[1:3]


@pytest.mark.django_db
def test_owner_final_query_rechecks_current_revocations_and_omits_new_raw_scopes(
    org_a, make_member
):
    context = inventory_context(org_a, make_member)
    candidates = []
    for _ in range(8):
        _, member = make_member(org_a, ["location.read"])
        allow_all(member)
        candidates.append(member)
    query = eligible_location_owners(context.actor, Placement(context.center, None))
    candidates[0].profiles.clear()
    Profile.objects.filter(pk=candidates[1].profiles.get().pk).update(permission_codes=[])
    set_raw_scope(candidates[2], default_scope())
    Profile.objects.filter(pk=candidates[3].profiles.get().pk).update(is_active=False)
    Membership.objects.filter(pk=candidates[4].pk).update(is_active=False)
    candidates[5].user.is_active = False
    candidates[5].user.save(update_fields=["is_active"])
    set_raw_scope(candidates[6].profiles.get(), default_scope())
    candidates[7].profiles.add(ProfileFactory(organization=org_a, slug="government"))
    _, new_member = make_member(org_a, ["location.read"])
    set_raw_scope(new_member, selected(context.center.pk))
    set_raw_scope(new_member.profiles.get(), selected(context.center.pk))
    assert new_member.pk not in set(query.values_list("pk", flat=True))
    assert not query.filter(pk__in=[member.pk for member in candidates]).exists()
    assert (
        eligible_location_owners(context.actor, Placement(context.center, None))
        .filter(pk=new_member.pk)
        .exists()
    )


def movement_request(context, values):
    raw = APIRequestFactory().get("/", values)
    request = Request(raw)
    request.user = context.actor.user
    request.organization = context.actor.organization
    return request


@pytest.mark.django_db
def test_real_movement_legs_explain_stock_with_exact_filters_and_persisted_provenance(
    org_a, make_member
):
    context = inventory_context(org_a, make_member, identity_kind="piece", quantity="2")
    second = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "SECOND-ADMISSION",
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "quantity": Decimal("1"),
                "provenance": "Second synthetic receipt",
            },
        )
    )
    query = location_movements(context.actor, context.location)
    rows = list(query.order_by("operation_id", "line_number"))
    assert len(rows) == 3
    assert len({row.operation_id for row in rows}) == 2
    assert sum(row.quantity for row in rows) == sum(
        row["quantity"] for row in location_stock(context.actor, context.location)
    )
    first = rows[0]
    payload = json.loads(JSONRenderer().render(MovementSerializer(first).data))
    assert payload["quantity"] == str(first.quantity)
    assert str(payload["created_by"]) == str(context.actor.user.pk)
    assert payload["created_at"] == first.created_at.isoformat().replace("+00:00", "Z")
    assert payload["source_kind"] == "lot_admission"
    assert payload["source_id"] == str(first.operation.admission_id)
    assert payload["unit_version_id"] == str(context.supply_version.pk)
    assert payload["unit"] == "piece"
    latest = revise_supply_type(
        MasterChange(
            context.actor,
            {"label": "Current movement master"},
            context.supply.pk,
            context.supply_version.revision,
        )
    )
    revise_lot(
        LotChange(
            context.actor,
            {"observations": "Later lot detail"},
            context.lot.pk,
            context.version.revision,
        )
    )
    assert latest.pk != first.unit_version_id
    assert (
        location_movements(context.actor, context.location).get(pk=first.pk).unit_version_id
        == context.supply_version.pk
    )
    for values, expected in (
        ({"lot": str(second.lot_id)}, 1),
        ({"supply": str(context.supply.pk), "unit": "piece"}, 3),
        ({"piece": str(first.piece_id)}, 1),
        ({"piece": "none"}, 0),
        ({"operation": str(first.operation_id)}, first.operation.movements.count()),
        ({"unit": "other"}, 0),
        (
            {
                "created_at_from": first.created_at.isoformat(),
                "created_at_before": (
                    max(row.created_at for row in rows) + timedelta(seconds=1)
                ).isoformat(),
            },
            sum(row.created_at >= first.created_at for row in rows),
        ),
    ):
        assert filter_movements(query, movement_request(context, values)).count() == expected


@pytest.mark.django_db
def test_exact_retained_supply_protocol_location_and_admission_survive_current_master_changes(
    org_a, make_member
):
    context = inventory_context(org_a, make_member, biological=True)
    configure_incident(context)
    pinned = current_lot(context.lot)
    incident_type = context.incident_type
    supply_pin = pinned.supply_version_id
    location_pin = pinned.location_version_id
    supply = revise_supply_type(
        MasterChange(
            context.actor,
            {
                "label": "Current replacement",
                "protocol": {"name": "Current replacement protocol", "incident_type_id": None},
            },
            context.supply.pk,
            context.supply_version.revision,
        )
    )
    deactivate_supply_type(MasterChange(context.actor, {}, context.supply.pk, supply.revision))
    write_type(
        context.actor,
        {
            "expected_revision": incident_type.revision,
            "label": "Current renamed type",
            "is_active": False,
        },
        incident_type.item_id,
    )
    revise_location(
        MasterChange(context.actor, {"name": "Current renamed location"}, context.location.pk, 1)
    )
    _, reader = make_member(org_a, ["lot.read"])
    allow_all(reader)
    payload = json.loads(JSONRenderer().render(LotSerializer(current_lot(context.lot)).data))
    assert payload["supply_version"]["version"] == str(supply_pin)
    assert payload["supply_version"]["label"] == "Synthetic supply"
    assert payload["supply_version"]["protocol"]["incident_type"] == {
        "incident_type_version_id": str(incident_type.pk),
        "code": incident_type.code,
        "label": incident_type.label,
    }
    assert payload["location_version"] == {
        "id": str(location_pin),
        "location_id": str(context.location.pk),
        "code": context.location.code,
        "name": "Synthetic store",
    }
    assert payload["admission_id"] == str(context.lot.admission.pk)
    assert supply.pk != supply_pin
    assert (
        lot_versions(UploadActor(reader.user, org_a), "lot.read")
        .get(lot=context.lot)
        .location_version_id
        == location_pin
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "case",
    [
        "inactive",
        "expired",
        "protocol",
        "unknown_safety",
        "unsafe",
        "null_safety",
        "missing_slot",
        "breach",
        "draft",
        "ready",
    ],
)
def test_blocker_sql_facets_match_current_lot_safety_including_drafts(
    org_a, make_member, monkeypatch, case
):
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))
    context = inventory_context(org_a, make_member, biological=True)
    if case == "inactive":
        deactivate_supply_type(MasterChange(context.actor, {}, context.supply.pk, 1))
    elif case == "expired":
        revise_lot(
            LotChange(context.actor, {"expires_at": AT}, context.lot.pk, context.version.revision)
        )
    elif case in ("protocol", "unknown_safety"):
        change = (
            {"protocol": {"name": ""}}
            if case == "protocol"
            else {"requires_insecticide_free": None}
        )
        supply = revise_supply_type(MasterChange(context.actor, change, context.supply.pk, 1))
        revise_lot(
            LotChange(
                context.actor,
                {"supply_version_id": supply.pk},
                context.lot.pk,
                context.version.revision,
            )
        )
    elif case in ("unsafe", "null_safety"):
        revise_location(
            MasterChange(
                context.actor,
                {"is_insecticide_free": False if case == "unsafe" else None},
                context.location.pk,
                1,
            )
        )
    elif case == "breach":
        record_condition(capture(context, AT, "21", "35"))
    elif case == "draft":
        context.version = revise_lot(
            LotChange(
                context.actor,
                {
                    "code": "DRAFT-READ",
                    "supply_id": context.supply.pk,
                    "center_id": context.center.pk,
                },
            )
        )
        context.lot = context.version.lot
    elif case == "ready":
        record_condition(capture(context, AT - timedelta(hours=12), "15", "35"))
        record_condition(capture(context, AT, "15", "35"))
    safety = lot_safety(current_lot(context.lot), AT)
    query = lot_versions(context.actor, "lot.read").filter(lot=context.lot)
    for reason in InventoryQuerySerializer().fields["blocked_by"].choices:
        assert query.filter(**{f"blocker_{reason}": True}).exists() == (reason in safety.blocked_by)
    assert query.get().computed_status == safety.status


@pytest.mark.django_db
def test_placement_choices_map_to_existing_writes_and_retain_admitted_identity(org_a, make_member):
    context = inventory_context(org_a, make_member)
    quadrant = Quadrant.objects.create(organization=org_a, center=context.center, code="CHOICE-Q")
    options = list(
        placement_options(context.actor, {"action": "location.create", "center": context.center.pk})
    )
    assert {(row["kind"], row["quadrant_id"]) for row in options} == {
        ("center_only", None),
        ("quadrant", quadrant.pk),
    }
    location_values = {
        "code": "CHOSEN-LOCATION",
        "center_id": context.center.pk,
        "quadrant_id": quadrant.pk,
        "name": "Synthetic chosen storage",
        "kind": "warehouse",
        "owner_id": context.member.pk,
        "geometry": {"type": "Point", "coordinates": [-99.0, 19.0]},
    }
    location = revise_location(MasterChange(context.actor, location_values)).location
    rows = list(
        placement_options(context.actor, {"action": "lot.create", "center": context.center.pk})
    )
    assert {row["location_id"] for row in rows} == {None, context.location.pk, location.pk}
    draft = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "CHOICE-DRAFT",
                "supply_id": context.supply.pk,
                "center_id": context.center.pk,
            },
        )
    )
    assert draft.lot.quadrant_id is None
    assert draft.initial_location_id is None
    assert {
        row["location_id"] for row in placement_options(context.actor, {"lot": draft.lot_id})
    } == {None, context.location.pk}
    located = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "CHOICE-LOCATED",
                "supply_id": context.supply.pk,
                "initial_location_id": location.pk,
            },
        )
    )
    assert located.lot.quadrant_id == quadrant.pk
    assert {
        row["location_id"] for row in placement_options(context.actor, {"lot": located.lot_id})
    } == {location.pk}
    admitted = list(placement_options(context.actor, {"lot": context.lot.pk}))
    assert [(row["location_id"], row["is_read_only"]) for row in admitted] == [
        (context.location.pk, True)
    ]
    hidden_quadrant = Quadrant.objects.create(
        organization=org_a, center=context.center, code="HIDDEN-Q"
    )
    revise_location(
        MasterChange(
            context.actor,
            {**location_values, "code": "HIDDEN-LOCATION", "quadrant_id": hidden_quadrant.pk},
        )
    )
    # Paired grants apply before count/slicing, independent of broad geography reads.
    context.profile.scope = selected(context.center.pk, quadrant.pk)
    context.profile.save(update_fields=["scope"])
    scoped_choices = placement_options(
        context.actor, {"action": "lot.create", "center": context.center.pk}
    )
    assert scoped_choices.count() == 3
    assert [row["location_id"] for row in scoped_choices[1:2]] == [location.pk]
    assert {
        row["location_id"]
        for row in placement_options(
            context.actor, {"action": "lot.create", "center": context.center.pk}
        )
    } == {None, context.location.pk, location.pk}


@pytest.mark.django_db
def test_local_expiry_bounds_filter_sql_before_count_and_page_across_dst(org_a, make_member):
    org_a.timezone = "America/New_York"
    org_a.save(update_fields=["timezone"])
    context = inventory_context(org_a, make_member)
    boundaries = [
        datetime(2026, 3, 8, 4, 59, 59, tzinfo=UTC),
        datetime(2026, 3, 8, 5, tzinfo=UTC),
        datetime(2026, 3, 9, 3, 59, 59, tzinfo=UTC),
        datetime(2026, 3, 9, 4, tzinfo=UTC),
    ]
    expected = []
    for index, expires_at in enumerate(boundaries):
        version = revise_lot(
            LotChange(
                context.actor,
                {
                    "code": f"DST-{index}",
                    "supply_id": context.supply.pk,
                    "center_id": context.center.pk,
                    "expires_at": expires_at,
                },
            )
        )
        if index in (1, 2):
            expected.append(version.pk)
    view = SimpleNamespace(
        action="list",
        inventory_facets={
            "expiry_from_date": "expires_at__gte",
            "expiry_before_date": "expires_at__lt",
            "expiry_from": "expires_at__gte",
            "expiry_before": "expires_at__lt",
        },
        required_permissions={"list": "lot.read"},
    )
    request = movement_request(
        context, {"expiry_from_date": "2026-03-08", "expiry_before_date": "2026-03-09"}
    )
    query = (
        InventoryTableFilter()
        .filter_queryset(request, lot_versions(context.actor, "lot.read"), view)
        .order_by("expires_at", "id")
    )
    assert query.count() == 2
    assert list(query.values_list("pk", flat=True)[:1]) == expected[:1]


@pytest.mark.django_db
def test_http_read_contract_wires_action_only_options_dual_scope_and_undisclosed_references(
    org_a, org_b, make_member, api_client, monkeypatch
):
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    context = inventory_context(org_a, make_member, biological=True)
    configure_incident(context)
    foreign = inventory_context(org_b, make_member)
    _, member = make_member(
        org_a,
        [
            "location.create",
            "location.update",
            "lot.create",
            "lot.update",
            "supply_type.create",
            "supply_type.update",
            "lot.read",
        ],
    )
    allow_all(member)
    api_client.force_authenticate(member.user)
    owners = "/api/v1/locations/owner-options/"
    placements = "/api/v1/locations/placement-options/"
    types = "/api/v1/supply-types/protocol-incident-type-options/"
    page = api_client.get(
        owners, {"center": str(context.center.pk), "quadrant": "none", "page_size": 1}
    ).json()
    assert page["count"] >= 1
    assert set(page["results"][0]) == {"membership_id", "label"}
    assert api_client.get(owners, {"location": str(context.location.pk)}).status_code == 200
    assert (
        api_client.get(placements, {"lot": str(context.lot.pk)}).json()["results"][0][
            "is_read_only"
        ]
        is True
    )
    for route, params in (
        (owners, {"center": str(foreign.center.pk), "quadrant": "none"}),
        (owners, {"location": str(foreign.location.pk)}),
        (placements, {"lot": str(foreign.lot.pk)}),
        (placements, {"action": "lot.create", "center": str(foreign.center.pk)}),
        (types, {"supply": str(foreign.supply.pk)}),
    ):
        assert api_client.get(route, params).status_code == 404
    for params in (
        {"lot": str(context.lot.pk), "center": str(context.center.pk)},
        {"lot": str(context.lot.pk), "action": "lot.create"},
        {"action": "lot.create", "center": str(context.center.pk), "quadrant": "none"},
    ):
        assert api_client.get(placements, params).status_code == 400
    lot_response = api_client.get(f"/api/v1/lots/{context.lot.pk}/").json()
    assert lot_response["location_version"]["id"] == str(context.version.location_version_id)
    assert api_client.get(f"/api/v1/locations/{context.location.pk}/").status_code == 403
    assert api_client.get(f"/api/v1/locations/{context.location.pk}/stock/").status_code == 403
    # Org masters remain action-only when both work axes deny storage.
    set_raw_scope(member, default_scope())
    types_page = api_client.get(types).json()
    assert types_page["results"] == [
        {
            "incident_type_version_id": str(context.incident_type.pk),
            "code": context.incident_type.code,
            "label": context.incident_type.label,
        }
    ]
    assert context.incident_type.pk != context.incident_type.item_id
    assert api_client.get(types, {"supply": str(context.supply.pk)}).status_code == 200
    deactivate_catalog_item(context.incident_type.item, context.actor.user)
    context.incident_type.refresh_from_db()
    assert context.incident_type.is_active is True
    assert api_client.get(types).json()["count"] == 0
    assert (
        api_client.get(owners, {"center": str(context.center.pk), "quadrant": "none"}).status_code
        == 404
    )
    allow_all(member)
    member.profiles.update(permission_codes=["location.read"])
    movements = f"/api/v1/locations/{context.location.pk}/movements/"
    assert api_client.get(movements).json()["count"] == 0
    assert (
        api_client.get(owners, {"center": str(context.center.pk), "quadrant": "none"}).status_code
        == 403
    )
    member.profiles.update(permission_codes=["location.read", "lot.read"])
    assert api_client.get(movements).json()["count"] == 1
    assert api_client.get(movements, {"piece": "none"}).json()["count"] == 1
    for params in (
        {"lot": str(foreign.lot.pk)},
        {"operation": str(foreign.lot.admission.operation.pk)},
        {"piece": str(uuid4())},
        {"supply": str(foreign.supply.pk)},
    ):
        assert api_client.get(movements, params).status_code == 404
    assert api_client.get(f"/api/v1/locations/{foreign.location.pk}/movements/").status_code == 404
    member.profiles.update(permission_codes=["location.update", "lot.update"])
    Center.objects.filter(pk=context.center.pk).update(is_active=False)
    assert api_client.get(owners, {"location": str(context.location.pk)}).status_code == 404
    assert api_client.get(placements, {"lot": str(context.lot.pk)}).status_code == 404
