"""Security sweep, round 2: narrow lookups, center admin fields and center rechecks under lock."""

import pytest
from rest_framework.exceptions import NotFound
from rest_framework.test import APIClient

from accounts.models import Personnel
from geography.models import Quadrant
from organizations.defaults import (
    DEFAULT_PROFILE_PERMISSIONS,
    WITHDRAWN_DEFAULT_PERMISSIONS,
    seed_default_permission_codes,
)
from organizations.models import Center, Profile, all_scope
from shifts.models import Motorcycle
from tests.factories import OrganizationFactory

pytestmark = pytest.mark.django_db


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
def two_centers(org_a, make_member):
    north = Center.objects.create(organization=org_a, code="NORTE", name="Norte")
    south = Center.objects.create(organization=org_a, code="SUR", name="Sur")
    quadrants = {
        center.code: Quadrant.objects.create(
            organization=org_a, center=center, code=f"Q-{center.code}"
        )
        for center in (north, south)
    }
    people = {}
    for center in (north, south):
        user, member = make_member(org_a)
        people[center.code] = Personnel.objects.create(
            organization=org_a,
            created_by=user,
            membership=member,
            center=center,
            display_name=f"Persona {center.code}",
            work_email=f"{center.code.lower()}@example.test",
            work_phone="5550000000",
        )
    return north, south, quadrants, people


# --- #3: the entomologist and regulatory defaults no longer carry the broad reads ------------


def test_default_entomologist_and_regulatory_hold_only_the_narrow_lookups():
    entomologist = set(DEFAULT_PROFILE_PERMISSIONS["entomologist"])
    regulatory = set(DEFAULT_PROFILE_PERMISSIONS["regulatory"])

    assert {"quadrant.lookup", "user.lookup"} <= entomologist
    assert not {"quadrant.read", "user.operational_read"} & entomologist
    assert "quadrant.lookup" in regulatory
    assert "quadrant.read" not in regulatory


def test_quadrant_lookup_serves_codes_and_outlines_only_inside_the_center(
    org_a, make_member, two_centers
):
    north, south, quadrants, _ = two_centers
    user, member = make_member(org_a, ("quadrant.lookup",))
    set_scope(member, selected(north))
    client = client_for(user)

    listed = client.get("/api/v1/lookups/quadrants/")
    assert listed.status_code == 200, listed.data
    assert [row["code"] for row in listed.data["results"]] == ["Q-NORTE"]
    assert set(listed.data["results"][0]) == {"id", "code", "center", "current_version"}
    foreign = quadrants["SUR"].pk
    assert client.get(f"/api/v1/lookups/quadrants/{foreign}/").status_code == 404
    assert client.get(f"/api/v1/lookups/quadrants/?center={south.pk}").data["count"] == 0
    # The narrow code never opens the broad geography reads.
    for path in ("/api/v1/quadrants/", "/api/v1/sampling-points/", "/api/v1/blocks/"):
        assert client.get(path).status_code == 403, path


def test_user_lookup_serves_names_only_inside_the_center(org_a, make_member, two_centers):
    north, _, _, people = two_centers
    user, member = make_member(org_a, ("user.lookup",))
    set_scope(member, selected(north))
    client = client_for(user)

    listed = client.get("/api/v1/lookups/users/")
    assert listed.status_code == 200, listed.data
    rows = listed.data["results"]
    assert [row["display_name"] for row in rows] == ["Persona NORTE"]
    assert set(rows[0]) == {"id", "display_name", "is_courier"}
    foreign = people["SUR"].membership.user_id
    assert client.get(f"/api/v1/lookups/users/{foreign}/").status_code == 404
    assert client.get("/api/v1/users/operational/").status_code == 403


def test_the_broad_reads_still_unlock_the_lookups(org_a, make_member, two_centers):
    user, member = make_member(org_a, ("quadrant.read", "user.operational_read"))
    set_scope(member, all_scope())
    client = client_for(user)

    assert client.get("/api/v1/lookups/quadrants/").data["count"] == 2
    assert client.get("/api/v1/lookups/users/").data["count"] == 2


def test_without_any_lookup_code_the_answer_is_403(org_a, make_member):
    user, _ = make_member(org_a, ("center.read",))
    client = client_for(user)

    assert client.get("/api/v1/lookups/quadrants/").status_code == 403
    assert client.get("/api/v1/lookups/users/").status_code == 403


def test_the_seed_withdraws_the_broad_reads_it_granted_but_never_an_admin_grant():
    organization = OrganizationFactory()
    granted_by_seed = Profile.objects.create(
        organization=organization,
        slug="entomologist",
        label_es="Entomólogo",
        label_en="Entomologist",
        created_by_seed=True,
        permission_codes=["quadrant.read", "user.operational_read"],
        seeded_permission_codes=["quadrant.read", "user.operational_read"],
    )
    granted_by_admin = Profile.objects.create(
        organization=organization,
        slug="regulatory",
        label_es="Regulatorio",
        label_en="Regulatory",
        created_by_seed=True,
        permission_codes=["quadrant.read"],
        seeded_permission_codes=[],
    )

    plan = seed_default_permission_codes(organization)

    granted_by_seed.refresh_from_db()
    granted_by_admin.refresh_from_db()
    assert set(plan.withdrawals["entomologist"]) == set(
        WITHDRAWN_DEFAULT_PERMISSIONS["entomologist"]
    )
    assert not {"quadrant.read", "user.operational_read"} & set(granted_by_seed.permission_codes)
    assert {"quadrant.lookup", "user.lookup"} <= set(granted_by_seed.permission_codes)
    assert "quadrant.read" in granted_by_admin.permission_codes
    assert "regulatory" not in plan.withdrawals
    # Idempotent: a second run withdraws nothing more.
    assert seed_default_permission_codes(organization).withdrawals == {}


# --- #4: courier and promoter never see the center admin facts --------------------------------


def test_a_plain_center_reader_gets_no_admin_facts(org_a, make_member):
    center = Center.objects.create(organization=org_a, code="NORTE", name="Norte")
    Motorcycle.objects.create(organization=org_a, center=center, code="M-01")
    reader, reader_member = make_member(org_a, ("center.read",))
    set_scope(reader_member, all_scope())
    admin, admin_member = make_member(org_a, ("center.read", "center.update"))
    set_scope(admin_member, all_scope())

    plain = client_for(reader).get(f"/api/v1/centers/{center.pk}/").data
    managed = client_for(admin).get(f"/api/v1/centers/{center.pk}/").data

    for field in (
        "deactivated_at",
        "deactivated_reason",
        "deactivated_by_name",
        "quadrant_count",
        "warehouse_count",
        "motorcycle_count",
    ):
        assert plain[field] is None, field
    assert plain["code"] == "NORTE"
    assert managed["motorcycle_count"] == 1
    listed = client_for(reader).get("/api/v1/centers/").data["results"]
    assert listed[0]["motorcycle_count"] is None


# --- #5: center writes recheck the actor under the center lock --------------------------------


@pytest.mark.parametrize("operation", ["rename", "deactivate", "reactivate"])
def test_a_center_write_rechecks_the_actor_grant_under_the_lock(org_a, make_member, operation):
    from organizations.centers import deactivate_center, reactivate_center, rename_center

    center = Center.objects.create(organization=org_a, code="NORTE", name="Norte")
    other = Center.objects.create(organization=org_a, code="SUR", name="Sur")
    if operation == "reactivate":
        Center.objects.filter(pk=center.pk).update(is_active=False)
        center.refresh_from_db()
    user, member = make_member(org_a, ("center.read", "center.update", "center.deactivate"))
    # The grant changed after the request was authorized: it now covers another center only.
    set_scope(member, selected(other))
    calls = {
        "rename": lambda: rename_center(center, "Nuevo", user),
        "deactivate": lambda: deactivate_center(center, "Cierre de la sede", user),
        "reactivate": lambda: reactivate_center(center, user),
    }

    with pytest.raises(NotFound):
        calls[operation]()
    center.refresh_from_db()
    assert center.name == "Norte"
    assert center.is_active is (operation != "reactivate")


def test_move_motorcycles_rechecks_the_destination_inside_the_lock(org_a, make_member):
    from organizations.center_closure import move_motorcycles

    origin = Center.objects.create(organization=org_a, code="NORTE", name="Norte")
    closed = Center.objects.create(organization=org_a, code="SUR", name="Sur")
    foreign = Center.objects.create(organization=org_a, code="ESTE", name="Este")
    Motorcycle.objects.create(organization=org_a, center=origin, code="M-01")
    user, member = make_member(org_a, ("center.read", "motorcycle.manage"))
    set_scope(
        member,
        {
            "centers": {"mode": "selected", "ids": [str(origin.pk), str(closed.pk)]},
            "quadrants": {"mode": "all", "ids": []},
        },
    )
    # Deactivated after the view validated it.
    Center.objects.filter(pk=closed.pk).update(is_active=False)

    to_closed = move_motorcycles(origin, closed, user)
    to_foreign = move_motorcycles(origin, foreign, user)

    assert [(row["status"], row["reason"]) for row in to_closed] == [
        ("failed", "center_state_conflict")
    ]
    assert [(row["status"], row["reason"]) for row in to_foreign] == [("failed", "not_found")]
    assert Motorcycle.objects.get(code="M-01").center_id == origin.pk
