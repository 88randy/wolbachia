"""The B33 temporal policy, once at its cheapest deterministic layer."""

from datetime import UTC, datetime

import pytest


@pytest.mark.parametrize(
    ("captured", "received", "closed", "expected"),
    [
        (9, 10, None, None),
        (9, 10, 11, None),
        (9, 10, 10, "late_work_after_quadrant_close"),
        (9, 12, 10, "late_work_after_quadrant_close"),
        (10, 12, 10, "captured_after_quadrant_close"),
        (11, 12, 10, "captured_after_quadrant_close"),
    ],
)
def test_first_delivery_classifies_closed_epoch_without_reopening(
    captured, received, closed, expected
):
    from geography.decisions.policy import classify_closed_epoch

    def instant(hour):
        return datetime(2026, 1, 15, hour, tzinfo=UTC)

    assert (
        classify_closed_epoch(
            instant(captured), instant(received), None if closed is None else instant(closed)
        )
        == expected
    )


@pytest.mark.parametrize(
    ("instant", "zone", "expected"),
    [
        ("2026-01-01T01:00:00+00:00", "America/Mexico_City", "2026-01-01"),
        ("2026-12-31T20:00:00+00:00", "Asia/Tokyo", "2027-01-02"),
        ("2026-03-08T07:30:00+00:00", "America/New_York", "2026-03-09"),
    ],
)
def test_rejection_next_day_uses_org_calendar_not_utc_or_capture_time(instant, zone, expected):
    from geography.decisions.policy import next_organization_day

    assert next_organization_day(datetime.fromisoformat(instant), zone).isoformat() == expected


def test_b33_defaults_match_documented_decision_and_intervention_roles_only():
    from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS

    actions = {"relocation.decide", "quadrant.close", "intervention.read", "intervention.create"}
    actual = {slug: set(codes) & actions for slug, codes in DEFAULT_PROFILE_PERMISSIONS.items()}
    assert {slug: codes for slug, codes in actual.items() if codes} == {
        "admin": actions,
        "supervisor": actions,
        "entomologist": {"intervention.read", "intervention.create"},
    }


@pytest.mark.parametrize("shape", ["absent", "legacy", "future", "empty", "exact"])
def test_closure_void_uses_exact_retirement_proof_and_unknown_snapshot_fails_closed(shape):
    from uuid import uuid4

    from geography.decisions.retirements import closure_dependency

    source = uuid4()
    snapshot = {"version": 1, "revision": 3, "blockers": [], "retirements": []}
    expected = False
    if shape == "absent":
        snapshot = None
        expected = None
    elif shape == "legacy":
        snapshot = {"revision": 3, "blockers": []}
        expected = None
    elif shape == "future":
        snapshot["version"] = 2
        expected = None
    elif shape == "exact":
        snapshot["retirements"] = [
            {
                "kind": "removal",
                "record_id": str(uuid4()),
                "event_id": str(source),
                "physical_id": str(uuid4()),
            }
        ]
        expected = True
    assert closure_dependency(snapshot, source, 3) is expected


@pytest.mark.parametrize("kind", ["quadrant", "block"])
def test_reference_contract_carries_closure_only_for_quadrants(kind):
    from uuid import uuid4

    from field_sync.projection_serializers import QuadrantReferenceSerializer

    row = {
        "resource_type": kind,
        "id": str(uuid4()),
        "code": "B33-reference",
        "center_id": str(uuid4()),
        "quadrant_id": str(uuid4()),
        "revision": 1,
    }
    closure = {"is_closed": True, "closure_id": str(uuid4())}
    if kind == "quadrant":
        serializer = QuadrantReferenceSerializer(data=row | closure)
        assert serializer.is_valid(), serializer.errors
        assert serializer.data == row | closure
        legacy = QuadrantReferenceSerializer(data=row)
        assert legacy.is_valid(), legacy.errors
        assert legacy.data == row
    else:
        serializer = QuadrantReferenceSerializer(data=row)
        assert serializer.is_valid(), serializer.errors
        assert serializer.data == row
        invalid = QuadrantReferenceSerializer(data=row | closure)
        assert not invalid.is_valid()
