"""W64 management reads use the real immutable policy and named eligibility."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from catalogs.models import CatalogItem
from catalogs.seeds import seed_default_catalogs
from incidents.configuration import write_type
from incidents.models import IncidentTypeVersion
from organizations.models import all_scope
from tests.factories import ProfileFactory
from uploads.access import UploadActor


def scoped_member(make_member, organization, codes):
    user, member = make_member(organization, codes)
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    return user, member


@pytest.fixture
def configuration_case(org_a, make_member):
    seed_default_catalogs(org_a)
    user, manager = scoped_member(make_member, org_a, ["incident.manage_type"])
    owner_user, owner = scoped_member(make_member, org_a, ["incident.read", "incident.close"])
    owner_user.first_name, owner_user.last_name = "Named", "Supervisor"
    owner_user.save(update_fields=["first_name", "last_name"])
    terminal_user, terminal = scoped_member(
        make_member,
        org_a,
        ["incident.read", "incident.close", "organization.update", "role.update"],
    )
    terminal_user.first_name, terminal_user.last_name = "Duty", "Manager"
    terminal_user.save(update_fields=["first_name", "last_name"])
    actor = UploadActor(user, org_a)
    version = write_type(
        actor,
        {
            "code": "z-condition",
            "label": "Condition",
            "severity": "high",
            "terminal_id": terminal.pk,
            "supervisor_id": owner.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
            "report_evidence_min": 2,
            "close_evidence_min": 3,
            "blocker_kinds": ["dispatch"],
        },
    )
    client = APIClient()
    client.force_authenticate(user)
    return SimpleNamespace(
        actor=actor, manager=manager, owner=owner, terminal=terminal, version=version, client=client
    )


@pytest.mark.django_db
def test_manager_only_can_read_configuration_and_reader_keeps_legacy_list(
    configuration_case, make_member
):
    case = configuration_case
    response = case.client.get("/api/v1/incident-types/", {"code": case.version.code})
    assert response.status_code == 200
    assert response.data["results"][0]["supervisor_display"] == "Named Supervisor"
    assert response.data["results"][0]["terminal_display"] == "Duty Manager"
    reader, _ = scoped_member(make_member, case.actor.organization, ["incident.read"])
    case.client.force_authenticate(reader)
    visible = case.client.get("/api/v1/incident-types/")
    assert visible.status_code == 200
    assert visible.data["results"][0]["terminal_display"] is None
    assert case.client.get("/api/v1/incident-types/owner-options/").status_code == 403
    assert case.client.get("/api/v1/incident-types/unconfigured-items/").status_code == 403
    assert (
        case.client.get(f"/api/v1/incident-types/{case.version.item_id}/versions/").status_code
        == 403
    )
    denied, _ = scoped_member(make_member, case.actor.organization, [])
    case.client.force_authenticate(denied)
    assert case.client.get("/api/v1/incident-types/").status_code == 403


@pytest.mark.django_db
def test_configuration_roster_filters_complete_eligibility_before_search_and_page(
    configuration_case, org_b, make_member
):
    case = configuration_case
    inactive_user, inactive = scoped_member(
        make_member, case.actor.organization, ["incident.read", "incident.close"]
    )
    inactive.is_active = False
    inactive.save(update_fields=["is_active"])
    inactive_user.first_name = "Named inactive"
    inactive_user.save(update_fields=["first_name"])
    foreign_user, _ = scoped_member(make_member, org_b, ["incident.read", "incident.close"])
    foreign_user.first_name = "Named foreign"
    foreign_user.save(update_fields=["first_name"])
    _user, disjoint = scoped_member(make_member, case.actor.organization, ["incident.read"])
    read_profile = disjoint.profiles.get()
    read_profile.scope = {
        "centers": {"mode": "selected", "ids": [str(uuid4())]},
        "quadrants": {"mode": "all", "ids": []},
    }
    read_profile.save(update_fields=["scope"])
    disjoint.profiles.add(
        ProfileFactory(
            organization=case.actor.organization,
            permission_codes=["incident.close"],
            scope={
                "centers": {"mode": "selected", "ids": [str(uuid4())]},
                "quadrants": {"mode": "all", "ids": []},
            },
        )
    )
    _user, government = scoped_member(
        make_member, case.actor.organization, ["incident.read", "incident.close"]
    )
    government.profiles.add(
        ProfileFactory(organization=case.actor.organization, slug="government", scope=all_scope())
    )
    result = case.client.get("/api/v1/incident-types/owner-options/", {"page_size": 1})
    assert result.status_code == 200
    assert result.data["count"] == 2
    assert result.data["results"] == [
        {
            "membership_id": str(case.terminal.pk),
            "label": "Duty Manager",
            "is_terminal_eligible": True,
        }
    ]
    search = case.client.get("/api/v1/incident-types/owner-options/", {"search": "Named"})
    assert search.data["results"] == [
        {
            "membership_id": str(case.owner.pk),
            "label": "Named Supervisor",
            "is_terminal_eligible": False,
        }
    ]
    exact = case.client.get(
        "/api/v1/incident-types/owner-options/", {"membership_id": str(case.owner.pk)}
    )
    assert exact.data["results"] == search.data["results"]
    denied = case.client.get(
        "/api/v1/incident-types/owner-options/", {"membership_id": str(disjoint.pk)}
    )
    assert denied.data["count"] == 0
    invalid = case.client.patch(
        f"/api/v1/incident-types/{case.version.item_id}/",
        {"expected_revision": 1, "supervisor_id": str(disjoint.pk)},
        format="json",
    )
    assert invalid.status_code == 409


@pytest.mark.django_db
def test_configuration_versions_keep_exact_pins_and_hide_unknown_or_foreign_targets(
    configuration_case, org_b
):
    case = configuration_case
    revised = write_type(
        case.actor,
        {"expected_revision": 1, "report_evidence_min": 4, "blocker_kinds": ["quadrant_closure"]},
        case.version.item_id,
    )
    endpoint = f"/api/v1/incident-types/{case.version.item_id}/versions/"
    response = case.client.get(endpoint, {"page_size": 1})
    assert response.status_code == 200
    assert response.data["count"] == 2
    assert response.data["results"][0]["current_version_id"] == str(revised.pk)
    assert response.json()["results"][0]["created_by"] == str(case.actor.user.pk)
    assert response.data["results"][0]["created_at"]
    previous = case.client.get(endpoint, {"page_size": 1, "page": 2}).data["results"][0]
    assert previous["revision"] == 1
    assert previous["report_evidence_min"] == 2
    assert previous["close_evidence_min"] == 3
    assert previous["blocker_kinds"] == ["dispatch"]
    assert previous["supervisor_display"] == "Named Supervisor"
    assert IncidentTypeVersion.objects.get(pk=case.version.pk).report_evidence_min == 2
    seed_default_catalogs(org_b)
    foreign = CatalogItem.objects.filter(organization=org_b, catalog__slug="incident-type").first()
    for identifier in (uuid4(), foreign.pk, case.version.pk, "not-a-uuid"):
        hidden = case.client.get(f"/api/v1/incident-types/{identifier}/versions/")
        assert hidden.status_code == 404


@pytest.mark.django_db
def test_other_is_last_in_server_ordering_and_code_lookup_stays_exact(configuration_case):
    case = configuration_case
    other = CatalogItem.objects.get(
        organization=case.actor.organization, catalog__slug="incident-type", is_other=True
    )
    write_type(
        case.actor,
        {
            "expected_revision": 0,
            "severity": "low",
            "terminal_id": case.terminal.pk,
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
        },
        other.pk,
    )
    for ordering in ("code", "-code", "created_at"):
        result = case.client.get("/api/v1/incident-types/", {"ordering": ordering})
        assert result.status_code == 200
        assert result.data["results"][-1]["is_other"] is True
    assert case.client.get("/api/v1/incident-types/", {"code": "z-condition"}).data["count"] == 1


@pytest.mark.django_db
def test_manager_discovers_and_configures_seeded_other_without_catalog_permission(
    configuration_case, org_b
):
    case = configuration_case
    seed_default_catalogs(org_b)
    other = CatalogItem.objects.get(
        organization=case.actor.organization, catalog__slug="incident-type", is_other=True
    )
    response = case.client.get("/api/v1/incident-types/unconfigured-items/", {"page_size": 1})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"] == [
        {
            "id": str(other.pk),
            "code": other.code,
            "label": other.label_es,
            "icon": other.icon,
            "is_other": True,
        }
    ]
    exact = case.client.get("/api/v1/incident-types/unconfigured-items/", {"code": "other"})
    assert exact.data["results"] == response.data["results"]
    absent = case.client.get("/api/v1/incident-types/unconfigured-items/", {"code": "unknown"})
    assert absent.data["count"] == 0
    assert (
        case.client.get("/api/v1/incident-types/unconfigured-items/", {"code": ""}).status_code
        == 400
    )
    configured = case.client.patch(
        f"/api/v1/incident-types/{other.pk}/",
        {
            "expected_revision": 0,
            "severity": "low",
            "terminal_id": str(case.terminal.pk),
            "supervisor_sla_seconds": 60,
            "coordinator_sla_seconds": 120,
        },
        format="json",
    )
    assert configured.status_code == 200
    assert configured.data["is_other"] is True
    assert configured.data["label"] == other.label_es
    assert configured.data["revision"] == 1
    assert case.client.get("/api/v1/incident-types/unconfigured-items/").data["count"] == 0
