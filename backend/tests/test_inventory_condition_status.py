"""W18 reads prove exact current monitoring facts without inferring from pages."""

from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from inventory.conditions import ConditionCapture, record_condition, record_condition_at_location
from inventory.masters import MasterChange, revise_supply_type
from inventory.models import ConditionIncidentLink
from inventory.services import LotChange, revise_lot
from organizations.models import all_scope
from tests.factories import ProfileFactory
from tests.inventory_support import AT, allow_all, biological_context, capture, inventory_context


@pytest.fixture
def monitoring(org_a, make_member, monkeypatch):
    return biological_context(org_a, make_member, monkeypatch)


def status_path(context):
    return f"/api/v1/lots/{context.lot.pk}/condition-status/"


@pytest.mark.django_db
def test_daily_status_counts_distinct_current_slots_independently_of_history_page(
    monitoring, api_client
):
    record_condition(capture(monitoring, AT - timedelta(hours=12), "15", "35"))
    duplicate = record_condition(capture(monitoring, AT - timedelta(hours=11), "16", "36"))
    api_client.force_authenticate(monitoring.actor.user)
    payload = api_client.get(status_path(monitoring)).json()
    assert payload["local_date"] == "2026-11-06"
    assert payload["timezone"] == monitoring.actor.organization.timezone
    assert payload["evaluated_at"] == "2026-11-06T18:00:00Z"
    assert payload["location_id"] == str(monitoring.location.pk)
    assert payload["slots"] == [
        {"slot": 0, "window": [0, 720], "is_complete": True, "reading_id": str(duplicate.pk)},
        {"slot": 1, "window": [720, 1440], "is_complete": False, "reading_id": None},
    ]
    assert "condition_slot_missing" in payload["blocked_by"]
    history = api_client.get(
        f"/api/v1/lots/{monitoring.lot.pk}/conditions/", {"page_size": 1}
    ).json()
    assert history["count"] == 2
    assert len(history["results"]) == 1
    second = record_condition(capture(monitoring, AT, "15", "35"))
    complete = api_client.get(status_path(monitoring)).json()
    assert [slot["is_complete"] for slot in complete["slots"]] == [True, True]
    assert complete["slots"][1]["reading_id"] == str(second.pk)
    assert complete["status"] == "available"


@pytest.mark.django_db
@pytest.mark.parametrize("pin", ["successor", "missing", "unassessed"])
def test_status_returns_exact_lot_protocol_and_old_readings_do_not_complete_new_pin(
    monitoring, api_client, pin
):
    original = record_condition(capture(monitoring, AT, "15", "35"))
    changes = {"protocol_id": None}
    if pin != "missing":
        supply = revise_supply_type(
            MasterChange(
                monitoring.actor,
                {
                    "protocol": {"temperature_max": Decimal("25")}
                    if pin == "successor"
                    else {"shelf_life_seconds": None}
                },
                monitoring.supply.pk,
                monitoring.supply_version.revision,
            )
        )
        changes = {"supply_version_id": supply.pk}
    version = revise_lot(
        LotChange(monitoring.actor, changes, monitoring.lot.pk, monitoring.version.revision)
    )
    if pin == "unassessed":
        unassessed = record_condition(capture(monitoring, AT.replace(minute=1), "15", "35"))
        assert unassessed.evaluation == "unassessed"
    api_client.force_authenticate(monitoring.actor.user)
    payload = api_client.get(status_path(monitoring)).json()
    assert payload["lot_version_id"] == str(version.pk)
    assert payload["protocol_id"] == (str(version.protocol_id) if version.protocol_id else None)
    assert [slot["is_complete"] for slot in payload["slots"]] == [False, False]
    assert payload["is_protocol_configured"] == (pin == "successor")
    if pin == "missing":
        assert payload["protocol"] is None
        assert payload["slots"][0]["window"] is None
        assert "protocol_not_configured" in payload["blocked_by"]
    elif pin == "successor":
        assert payload["protocol"]["id"] == str(version.protocol_id)
        assert payload["protocol"]["temperature_max"] == "25.000000"
    original.refresh_from_db()
    assert original.protocol_id != version.protocol_id


@pytest.mark.django_db
@pytest.mark.parametrize("stale_fact", ["day", "timezone"])
def test_daily_status_excludes_old_local_days_and_old_capture_timezones(
    monitoring, api_client, stale_fact
):
    record_condition(capture(monitoring, AT - timedelta(days=1, hours=12), "15", "35"))
    record_condition(capture(monitoring, AT, "15", "35"))
    organization = monitoring.actor.organization
    if stale_fact == "timezone":
        organization.timezone = "America/New_York"
        organization.save(update_fields=["timezone"])
    api_client.force_authenticate(monitoring.actor.user)
    payload = api_client.get(status_path(monitoring)).json()
    assert payload["timezone"] == organization.timezone
    assert [slot["is_complete"] for slot in payload["slots"]] == [False, stale_fact == "day"]


@pytest.mark.django_db
def test_blocking_links_span_locations_but_respect_each_current_action_pair(
    monitoring, org_a, make_member, api_client
):
    other = inventory_context(org_a, make_member)
    first = record_condition(capture(monitoring, AT, "21", "35"))
    second = record_condition_at_location(
        ConditionCapture(
            monitoring.actor,
            monitoring.lot.pk,
            AT,
            Decimal("22"),
            Decimal("35"),
            other.location.pk,
        )
    )
    record_condition(capture(monitoring, AT.replace(minute=1), "15", "35"))
    links = ConditionIncidentLink.objects.filter(breach__reading__in=[first, second])
    expected = sorted(
        ({"id": str(link.incident_id), "code": link.incident.code} for link in links),
        key=lambda row: row["code"],
    )
    api_client.force_authenticate(monitoring.actor.user)
    payload = api_client.get(status_path(monitoring)).json()
    assert payload["blocking_incidents"] == expected
    assert "condition_breach" in payload["blocked_by"]
    at_other = api_client.get(
        status_path(monitoring), {"location_id": str(other.location.pk)}
    ).json()
    assert at_other["location_id"] == str(other.location.pk)
    assert at_other["slots"][1]["reading_id"] == str(second.pk)
    monitoring.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(monitoring.center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    monitoring.profile.save(update_fields=["scope"])
    scoped = api_client.get(status_path(monitoring)).json()
    assert scoped["blocking_incidents"] == expected[:1]
    monitoring.profile.permission_codes.remove("incident.read")
    monitoring.profile.save(update_fields=["permission_codes"])
    redacted = api_client.get(status_path(monitoring)).json()
    assert redacted["blocking_incidents"] == []
    assert "condition_breach" in redacted["blocked_by"]


@pytest.mark.django_db
def test_condition_status_unknown_foreign_and_unassigned_targets_are_indistinguishable(
    monitoring, org_a, org_b, make_member, api_client
):
    foreign = inventory_context(org_b, make_member)
    reader, member = make_member(org_a, ["lot.read"])
    api_client.force_authenticate(reader)
    targets = [monitoring.lot.pk, foreign.lot.pk, uuid4()]
    responses = [api_client.get(f"/api/v1/lots/{key}/condition-status/") for key in targets]
    assert {response.status_code for response in responses} == {404}
    assert responses[0].json()["code"] == responses[1].json()["code"] == responses[2].json()["code"]
    allow_all(member)
    assert api_client.get(status_path(monitoring)).status_code == 200
    assert (
        api_client.get(
            status_path(monitoring), {"location_id": str(foreign.location.pk)}
        ).status_code
        == 404
    )
    member.profiles.update(permission_codes=["condition.create"], scope=all_scope())
    assert api_client.get(status_path(monitoring)).status_code == 403


@pytest.mark.django_db
def test_readable_measurement_site_without_lot_authority_does_not_reveal_current_status(
    monitoring, org_a, make_member, api_client
):
    other = inventory_context(org_a, make_member)
    reader, member = make_member(org_a, ["lot.read"])
    allow_all(member)
    profile = member.profiles.get()
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(other.center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    profile.save(update_fields=["scope"])
    api_client.force_authenticate(reader)
    location = {"location_id": str(other.location.pk)}
    # Site history/capture does not grant this lot's current metadata or global holds.
    assert (
        api_client.get(f"/api/v1/lots/{monitoring.lot.pk}/conditions/", location).status_code == 200
    )
    denied = api_client.get(status_path(monitoring), location)
    unknown = api_client.get(f"/api/v1/lots/{uuid4()}/condition-status/", location)
    assert denied.status_code == unknown.status_code == 404
    assert denied.json()["code"] == unknown.json()["code"]


@pytest.mark.django_db
def test_capture_eligibility_uses_the_actual_site_pair_not_the_action_union(
    monitoring, org_a, make_member, api_client
):
    other = inventory_context(org_a, make_member)
    monitoring.profile.permission_codes.remove("condition.create")
    monitoring.profile.save(update_fields=["permission_codes"])
    creation_profile = ProfileFactory(
        organization=org_a,
        permission_codes=["condition.create"],
        scope={
            "centers": {"mode": "selected", "ids": [str(other.center.pk)]},
            "quadrants": {"mode": "all", "ids": []},
        },
    )
    monitoring.member.profiles.add(creation_profile)
    api_client.force_authenticate(monitoring.actor.user)
    default = api_client.get(status_path(monitoring))
    assert default.status_code == 200
    assert default.json()["can_create_condition"] is False
    selected = api_client.get(status_path(monitoring), {"location_id": str(other.location.pk)})
    assert selected.status_code == 200
    assert selected.json()["can_create_condition"] is True
    creation_profile.scope = {
        "centers": {"mode": "none", "ids": []},
        "quadrants": {"mode": "all", "ids": []},
    }
    creation_profile.save(update_fields=["scope"])
    assert (
        api_client.get(status_path(monitoring), {"location_id": str(other.location.pk)}).json()[
            "can_create_condition"
        ]
        is False
    )
