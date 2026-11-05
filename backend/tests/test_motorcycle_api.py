"""Fleet API wiring: isolation, permissions, shared reason validation and snapshots."""

from datetime import UTC, datetime

import pytest

from shifts.models import Motorcycle, MotorcycleBlockEvent
from tests.factories import MotorcycleFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("void_catalog")]
URL = "/api/v1/motorcycles/"
SNAPSHOT_URL = "/api/v1/field/catalog/"
CODES = ["motorcycle.read", "motorcycle.manage", "motorcycle.unblock", "catalog.read"]


@pytest.fixture
def make_member(make_member):
    from tests.fleet_support import grant_fleet_scope

    return lambda *args, **kwargs: grant_fleet_scope(make_member(*args, **kwargs))


@pytest.fixture
def fleet_actor(org_a, make_member):
    return make_member(org_a, CODES)[0]


@pytest.fixture
def fleet_client(api_client, fleet_actor):
    api_client.force_authenticate(fleet_actor)
    return api_client


@pytest.fixture
def voided_motorcycle(org_a, fleet_actor):
    return MotorcycleFactory(
        organization=org_a,
        voided_at=datetime(2026, 11, 4, 12, tzinfo=UTC),
        voided_by=fleet_actor,
        void_reason="Duplicate vehicle record",
        void_reason_code="other",
    )


def test_create_assigns_the_active_organization_and_actor(fleet_client, org_a, fleet_actor):
    response = fleet_client.post(URL, {"code": "M-03"}, format="json")

    assert response.status_code == 201
    motorcycle = Motorcycle.objects.get(pk=response.data["id"])
    assert motorcycle.organization == org_a
    assert motorcycle.created_by == fleet_actor


def test_patch_updates_the_plate(fleet_client, org_a):
    motorcycle = MotorcycleFactory(organization=org_a, plate="TEST-03")

    response = fleet_client.patch(f"{URL}{motorcycle.pk}/", {"plate": "TEST-04"}, format="json")

    assert response.status_code == 200
    motorcycle.refresh_from_db()
    assert motorcycle.plate == response.data["plate"] == "TEST-04"


def test_patch_rejects_a_code_change_without_modifying_the_motorcycle(fleet_client, org_a):
    motorcycle = MotorcycleFactory(organization=org_a, code="M-03", plate="TEST-03")

    response = fleet_client.patch(
        f"{URL}{motorcycle.pk}/", {"code": "M-04", "plate": "TEST-04"}, format="json"
    )

    assert response.status_code == 400
    assert response.data["fields"]["code"] == [{"code": "immutable_code", "params": {}}]
    motorcycle.refresh_from_db()
    assert (motorcycle.code, motorcycle.plate) == ("M-03", "TEST-03")


@pytest.mark.parametrize("method", ["delete", "put"])
def test_motorcycles_disallow_destructive_or_replacement_methods(fleet_client, org_a, method):
    motorcycle = MotorcycleFactory(organization=org_a)

    response = getattr(fleet_client, method)(
        f"{URL}{motorcycle.pk}/", {"code": "M-03"}, format="json"
    )

    assert response.status_code == 405


def test_void_records_the_actor_and_normalized_reason(fleet_client, org_a, fleet_actor):
    motorcycle = MotorcycleFactory(organization=org_a)

    response = fleet_client.post(
        f"{URL}{motorcycle.pk}/void/",
        {"reason_code": "other", "reason": "  Duplicate vehicle record  "},
        format="json",
    )

    assert response.status_code == 200
    motorcycle.refresh_from_db()
    assert motorcycle.voided_at is not None
    assert motorcycle.voided_by == fleet_actor
    assert motorcycle.void_reason == response.data["void_reason"] == "Duplicate vehicle record"


@pytest.mark.parametrize(("query", "expected_count"), [({}, 0), ({"include_voided": "true"}, 1)])
def test_list_only_includes_voided_motorcycles_when_requested(
    fleet_client, voided_motorcycle, query, expected_count
):
    response = fleet_client.get(URL, query)

    assert response.status_code == 200
    assert response.data["count"] == expected_count


def test_voided_motorcycle_remains_retrievable(fleet_client, voided_motorcycle):
    response = fleet_client.get(f"{URL}{voided_motorcycle.pk}/")

    assert response.status_code == 200
    assert response.data["id"] == str(voided_motorcycle.pk)


@pytest.mark.parametrize("action", ["void", "unblock"])
def test_reason_actions_use_shared_validator_before_state(fleet_client, org_a, action):
    motorcycle = MotorcycleFactory(organization=org_a)
    response = fleet_client.post(
        f"{URL}{motorcycle.pk}/{action}/",
        {"reason": "\u200b", **({"reason_code": "other"} if action == "void" else {})},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["fields"]["reason"] == [
        {"code": "void_reason_too_short", "params": {"min_length": 10}}
    ]
    assert not MotorcycleBlockEvent.objects.exists()


@pytest.mark.parametrize("action", ["retrieve", "patch", "void", "unblock"])
def test_foreign_motorcycle_is_not_addressable(fleet_client, org_b, action):
    motorcycle = MotorcycleFactory(organization=org_b)
    detail = f"{URL}{motorcycle.pk}/"
    if action == "retrieve":
        response = fleet_client.get(detail)
    elif action == "patch":
        response = fleet_client.patch(detail, {"plate": "TEST"}, format="json")
    else:
        response = fleet_client.post(
            detail + action + "/", {"reason": "Vehicle repaired now"}, format="json"
        )
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("permission", "method", "suffix", "body"),
    [
        ("motorcycle.manage", "get", "", {}),
        ("motorcycle.read", "post", "", {"code": "M-04"}),
        ("motorcycle.read", "patch", "detail", {"plate": "TEST"}),
        (
            "motorcycle.read",
            "post",
            "void",
            {"reason_code": "other", "reason": "Duplicate vehicle record"},
        ),
        ("motorcycle.manage", "post", "unblock", {"reason": "Vehicle repaired now"}),
    ],
)
def test_actions_require_their_own_permission(
    api_client, org_a, make_member, permission, method, suffix, body
):
    api_client.force_authenticate(make_member(org_a, [permission])[0])
    motorcycle = MotorcycleFactory(organization=org_a)
    url = URL if not suffix else f"{URL}{motorcycle.pk}/"
    if suffix not in ("", "detail"):
        url += suffix + "/"
    assert getattr(api_client, method)(url, body, format="json").status_code == 403


def test_list_resolves_code_and_filters_blocked_state(fleet_client, org_a, org_b):
    MotorcycleFactory(organization=org_a, code="M-01")
    blocked = MotorcycleFactory(
        organization=org_a, code="M-02", is_blocked=True, blocked_reason="severe_check"
    )
    MotorcycleFactory(organization=org_b, code="M-02")
    response = fleet_client.get(URL, {"code": " M-02 ", "is_blocked": "true"})
    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == [str(blocked.pk)]
    assert fleet_client.get(URL, {"is_blocked": "invalid"}).status_code == 400


def test_unblock_persists_actor_and_normalized_reason(api_client, org_a, make_member):
    actor, _ = make_member(org_a, ["motorcycle.unblock"])
    api_client.force_authenticate(actor)
    motorcycle = MotorcycleFactory(
        organization=org_a, is_blocked=True, blocked_reason="severe_check"
    )
    response = api_client.post(
        f"{URL}{motorcycle.pk}/unblock/", {"reason": "  Vehicle repaired now  "}, format="json"
    )
    assert response.status_code == 200
    assert (response.data["is_blocked"], response.data["blocked_reason"]) == (False, "")
    audit = MotorcycleBlockEvent.objects.get(motorcycle=motorcycle)
    assert audit.created_by == actor
    assert audit.action == "unblock"
    assert audit.reason == "Vehicle repaired now"
    assert audit.organization == org_a
    assert audit.blocked_reason == "severe_check"


def test_unblocking_a_motorcycle_without_a_block_returns_conflict(fleet_client, org_a):
    motorcycle = MotorcycleFactory(organization=org_a)
    response = fleet_client.post(
        f"{URL}{motorcycle.pk}/unblock/", {"reason": "Vehicle repaired now"}, format="json"
    )
    assert response.status_code == 409
    assert response.data["code"] == "motorcycle_not_blocked"
    assert not MotorcycleBlockEvent.objects.exists()


def test_snapshot_includes_blocked_excludes_foreign_and_voided_and_revalidates(
    fleet_client, org_a, org_b
):
    motorcycle = MotorcycleFactory(
        organization=org_a, is_blocked=True, blocked_reason="severe_check"
    )
    MotorcycleFactory(organization=org_b)
    before = fleet_client.get(SNAPSHOT_URL)
    assert before.status_code == 200
    assert before.data["motorcycles"] == [
        {
            "id": str(motorcycle.pk),
            "code": motorcycle.code,
            "plate": motorcycle.plate,
            "is_blocked": True,
            "blocked_reason": "severe_check",
        }
    ]
    etag = before["ETag"]
    assert etag == f'"{before.data["version"]}"'
    cached = fleet_client.get(SNAPSHOT_URL, headers={"If-None-Match": etag})
    assert cached.status_code == 304
    assert cached["Cache-Control"] == "private, no-cache"
    assert cached["Vary"] == "X-Organization"
    fleet_client.post(
        f"{URL}{motorcycle.pk}/unblock/", {"reason": "Vehicle repaired now"}, format="json"
    )
    unblocked = fleet_client.get(SNAPSHOT_URL, headers={"If-None-Match": etag})
    assert unblocked.status_code == 200
    assert unblocked.data["motorcycles"][0]["is_blocked"] is False
    fleet_client.post(
        f"{URL}{motorcycle.pk}/void/",
        {"reason_code": "other", "reason": "Duplicate vehicle record"},
        format="json",
    )
    voided = fleet_client.get(SNAPSHOT_URL, headers={"If-None-Match": unblocked["ETag"]})
    assert voided.status_code == 200
    assert voided.data["motorcycles"] == []
