"""Own read-contract boundaries; database selection/authorization are tested separately."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

AT = datetime(2026, 2, 4, 18, tzinfo=UTC)


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ({}, None),
        ({"at": "2026-02-04T18:00:00"}, None),
        ({"at": "2026-02-04"}, None),
        ({"at": "2019-12-31T23:59:59Z"}, None),
        ({"at": "2100-01-01T00:00:00Z"}, None),
        ({"at": "not-an-instant"}, None),
        ({"at": "2026-02-04T12:00:00-06:00"}, AT),
    ],
)
def test_read_query_requires_an_explicit_aware_protocol_cutoff(query, expected):
    from ovitraps.lifecycle.serializers import OvitrapAdvisoryQuerySerializer

    serializer = OvitrapAdvisoryQuerySerializer(data=query)
    assert serializer.is_valid() is (expected is not None)
    if expected is None:
        assert set(serializer.errors) == {"at"}
    else:
        assert serializer.validated_data["at"] == expected


def test_unavailable_snapshot_never_fabricates_zero_or_rule_proof():
    from ovitraps.lifecycle.advisory import build_advisory_snapshot

    physical = SimpleNamespace(client_uuid=uuid4(), sampling_point_id=uuid4())
    first = build_advisory_snapshot(physical, AT, "future_cutoff")
    same = build_advisory_snapshot(physical, AT, "future_cutoff")
    missing_rules = build_advisory_snapshot(physical, AT, "rule_context_unavailable")
    assert first == same
    assert first["version"] != missing_rules["version"]
    assert first["state"] == "unavailable"
    assert first["as_of"] == "2026-02-04T18:00:00Z"
    assert all(
        first[key] is None
        for key in (
            "rule_context",
            "rule_context_version",
            "required_epi_weeks",
            "observed_closed_house_weeks",
            "incident_count",
            "suggested",
        )
    )


def test_legacy_bool_keeps_missing_rule_false_and_propagates_unexpected_failure(monkeypatch):
    from ovitraps.lifecycle import selectors

    physical = SimpleNamespace()
    monkeypatch.setattr(selectors, "select_advisory_observation", lambda *_args: None)
    assert selectors.suggest_relocation(physical, AT) is False

    def broken(*_args):
        raise RuntimeError("unexpected selector failure")

    monkeypatch.setattr(selectors, "select_advisory_observation", broken)
    with pytest.raises(RuntimeError, match="unexpected selector failure"):
        selectors.suggest_relocation(physical, AT + timedelta(seconds=1))


@pytest.mark.parametrize(
    ("zone", "convention", "expected"),
    [
        ("Missing/Zone", "iso", "organization_context_unavailable"),
        ("UTC", "unknown", "organization_context_unavailable"),
        ("UTC", "mmwr", None),
    ],
)
def test_unproved_organization_convention_is_unavailable_not_an_invented_calendar(
    monkeypatch, zone, convention, expected
):
    from ovitraps.lifecycle import advisory

    monkeypatch.setattr(advisory, "server_now", lambda: AT)
    organization = SimpleNamespace(timezone=zone, epi_week=convention)
    assert advisory.unavailable_context(organization, AT) == expected


def test_registered_read_contract_has_required_cutoff_null_results_and_no_mutation():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator().get_schema(request=None, public=True)
    route = schema["paths"]["/api/v1/field/ovitrap-advisories/{id}/"]
    assert set(route) == {"get"}
    operation = route["get"]
    cutoff = next(parameter for parameter in operation["parameters"] if parameter["name"] == "at")
    assert cutoff["required"] is True
    assert cutoff["schema"]["format"] == "date-time"
    assert set(operation["responses"]) >= {"200", "304", "default"}
    body = schema["components"]["schemas"]["OvitrapAdvisory"]["properties"]
    assert body["incident_count"]["nullable"] is True
    assert body["suggested"]["nullable"] is True
    assert body["observed_closed_house_weeks"]["maxItems"] == 8


@pytest.mark.parametrize(
    ("zone", "convention", "expected"),
    [
        ("America/Mexico_City", "iso", ("2026-W01", "2025-W52")),
        ("America/Mexico_City", "mmwr", ("2025-W53", "2025-W52")),
        ("UTC", "mmwr", ("2026-W01", "2025-W53")),
    ],
)
def test_required_labels_use_cutoff_local_date_and_observed_week_convention(
    zone, convention, expected
):
    from ovitraps.lifecycle.advisory_selectors import required_weeks

    physical = SimpleNamespace(organization=SimpleNamespace(timezone=zone, epi_week=convention))
    cutoff = datetime(2026, 1, 4, 1, tzinfo=UTC)
    assert required_weeks(physical, cutoff, 2) == expected
