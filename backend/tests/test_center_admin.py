"""Organization admin manages centers: create, rename, deactivate/reactivate and closure steps."""

from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from inventory.masters import MasterChange, revise_location
from inventory.transfers.models import Transfer
from organizations.models import Center, all_scope
from platform_admin.models import PlatformAuditEntry
from shifts.models import Motorcycle
from tests.inventory_support import AT, inventory_context

pytestmark = pytest.mark.django_db

CENTER_CODES = ("center.read", "center.create", "center.update", "center.deactivate")
MOVE_CODES = ("motorcycle.manage", "transfer.create", "transfer.read")


def set_scope(member, scope):
    member.scope = scope
    member.save(update_fields=["scope"])
    for profile in member.profiles.all():
        profile.scope = scope
        profile.save(update_fields=["scope"])


def selected(center):
    return {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }


def client_for(user):
    client = APIClient()
    client.default_format = "json"
    client.force_authenticate(user)
    return client


@pytest.fixture
def admin(org_a, make_member):
    user, member = make_member(org_a, (*CENTER_CODES, *MOVE_CODES))
    set_scope(member, all_scope())
    return client_for(user)


@pytest.fixture
def center(org_a):
    return Center.objects.create(organization=org_a, code="NORTE", name="Norte")


def test_create_center_records_audit(admin, org_a):
    response = admin.post("/api/v1/centers/", {"code": "SUR-1", "name": " Sur "}, format="json")

    assert response.status_code == 201, response.data
    assert response.data["code"] == "SUR-1"
    assert response.data["name"] == "Sur"
    assert response.data["is_active"] is True
    entry = PlatformAuditEntry.objects.get(action="center.create", organization=org_a)
    assert str(entry.target_id) == response.data["id"]


@pytest.mark.parametrize(
    ("body", "field", "code"),
    [
        ({"code": "norte", "name": "Otro"}, "code", "center_code_taken"),
        ({"code": "MAL CODIGO", "name": "Otro"}, "code", "invalid_code"),
        ({"code": "NUEVO", "name": "  "}, "name", "required"),
    ],
)
def test_create_center_validation(admin, center, body, field, code):
    response = admin.post("/api/v1/centers/", body, format="json")

    assert response.status_code == 400
    assert response.data["fields"][field][0]["code"] in {code, "blank"}


def test_update_renames_and_keeps_code(admin, center):
    response = admin.patch(
        f"/api/v1/centers/{center.pk}/", {"name": "Norte nuevo", "code": "X"}, format="json"
    )

    assert response.status_code == 200
    center.refresh_from_db()
    assert (center.code, center.name) == ("NORTE", "Norte nuevo")
    assert PlatformAuditEntry.objects.filter(action="center.update", target_id=center.pk).exists()


def test_deactivate_is_blocked_by_motorcycles_then_moves_and_closes(admin, org_a, center):
    other = Center.objects.create(organization=org_a, code="SUR", name="Sur")
    Motorcycle.objects.create(organization=org_a, center=center, code="M-01")
    url = f"/api/v1/centers/{center.pk}/"

    refused = admin.post(url + "deactivate/", {"reason": "Cierre de sede"}, format="json")
    assert refused.status_code == 409
    assert refused.data["code"] == "center_has_active_work"
    assert refused.data["blocked_by"][0]["reason"] == "motorcycles"
    assert refused.data["blocked_by"][0]["params"] == {"count": 1}

    moved = admin.post(
        url + "move-motorcycles/", {"destination_center": str(other.pk)}, format="json"
    )
    assert [row["status"] for row in moved.data["results"]] == ["moved"]
    rows = {row["key"]: row["count"] for row in admin.get(url + "readiness/").data["rows"]}
    assert rows["motorcycles"] == 0

    closed = admin.post(url + "deactivate/", {"reason": "Cierre de sede"}, format="json")
    assert closed.status_code == 200, closed.data
    assert closed.data["is_active"] is False
    assert closed.data["deactivated_reason"] == "Cierre de sede"
    listed = [row["code"] for row in admin.get("/api/v1/centers/").data["results"]]
    assert "NORTE" not in listed
    everything = admin.get("/api/v1/centers/?include_inactive=true").data["results"]
    assert "NORTE" in [row["code"] for row in everything]

    reopened = admin.post(url + "reactivate/")
    assert reopened.status_code == 200
    assert reopened.data["is_active"] is True
    actions = set(
        PlatformAuditEntry.objects.filter(target_id=center.pk).values_list("action", flat=True)
    )
    assert {"center.deactivate", "center.reactivate"} <= actions


def test_deactivate_requires_reason(admin, center):
    response = admin.post(f"/api/v1/centers/{center.pk}/deactivate/", {}, format="json")

    assert response.status_code == 400


def test_non_admin_cannot_manage(org_a, make_member, center):
    user, member = make_member(org_a, ("center.read",))
    set_scope(member, all_scope())
    client = client_for(user)

    assert (
        client.post("/api/v1/centers/", {"code": "X1", "name": "X"}, format="json").status_code
        == 403
    )
    deactivate = client.post(f"/api/v1/centers/{center.pk}/deactivate/", {"reason": "Cierre"})
    assert deactivate.status_code == 403
    assert client.patch(f"/api/v1/centers/{center.pk}/", {"name": "Y"}).status_code == 403


def test_limited_scope_cannot_create_or_see_other_centers(org_a, make_member, center):
    other = Center.objects.create(organization=org_a, code="SUR", name="Sur")
    user, member = make_member(org_a, CENTER_CODES)
    set_scope(member, selected(center))
    client = client_for(user)

    created = client.post("/api/v1/centers/", {"code": "X1", "name": "X"}, format="json")
    assert created.status_code == 403
    assert created.data["code"] == "center_scope_limited"
    assert client.get(f"/api/v1/centers/{other.pk}/").status_code == 404
    assert [row["code"] for row in client.get("/api/v1/centers/").data["results"]] == ["NORTE"]


def test_other_organization_centers_are_invisible(admin, org_b):
    foreign = Center.objects.create(organization=org_b, code="NORTE", name="Ajeno")

    assert admin.get(f"/api/v1/centers/{foreign.pk}/").status_code == 404
    response = admin.post(f"/api/v1/centers/{foreign.pk}/deactivate/", {"reason": "Cierre"})
    assert response.status_code == 404
    assert admin.post("/api/v1/centers/", {"code": "NORTE", "name": "Mio"}).status_code == 201


@pytest.fixture
def stocked(org_a, make_member, monkeypatch):
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))
    context = inventory_context(org_a, make_member, quantity="5")
    context.profile.permission_codes = [
        *context.profile.permission_codes,
        *CENTER_CODES,
        *MOVE_CODES,
    ]
    context.profile.save(update_fields=["permission_codes"])
    destination_center = Center.objects.create(organization=org_a, code="DESTINO", name="Destino")
    destination = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "DEST-WH",
                "center_id": destination_center.pk,
                "name": "Destination warehouse",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "quadrant_id": None,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    return context, destination


def test_move_stock_prepares_one_transfer_per_warehouse_and_replays(stocked):
    context, destination = stocked
    client = client_for(context.actor.user)
    url = f"/api/v1/centers/{context.center.pk}/"

    readiness = client.get(url + "readiness/").data
    assert {row["key"]: row["count"] for row in readiness["rows"]}["stock"] == 1
    first = client.post(url + "move-stock/", {"destination_location": str(destination.pk)})
    assert first.status_code == 200, first.data
    assert [row["status"] for row in first.data["results"]] == ["prepared"]
    assert first.data["results"][0]["line_count"] == 1

    again = client.post(url + "move-stock/", {"destination_location": str(destination.pk)})
    assert [row["status"] for row in again.data["results"]] == ["already_prepared"]
    assert Transfer.objects.filter(origin__center=context.center).count() == 1
    assert client.get(url + "readiness/").data["prepared_transfer_count"] == 1


def test_move_stock_by_a_second_admin_conflicts_instead_of_duplicating(stocked, make_member):
    context, destination = stocked
    url = f"/api/v1/centers/{context.center.pk}/move-stock/"
    body = {"destination_location": str(destination.pk)}
    client_for(context.actor.user).post(url, body)
    user, member = make_member(context.center.organization, context.profile.permission_codes)
    set_scope(member, all_scope())

    response = client_for(user).post(url, body)

    assert response.status_code == 200
    assert response.data["results"][0]["status"] == "failed"
    assert response.data["results"][0]["reason"] == "transfer_command_conflict"
    assert Transfer.objects.filter(origin__center=context.center).count() == 1


def test_move_stock_refuses_a_destination_in_the_same_center(stocked):
    context, _destination = stocked
    client = client_for(context.actor.user)
    url = f"/api/v1/centers/{context.center.pk}/move-stock/"

    response = client.post(url, {"destination_location": str(context.location.pk)})

    assert response.status_code == 404
