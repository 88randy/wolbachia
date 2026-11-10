"""B20 owns regulatory refusals; ledger/review integration is exercised separately."""

from datetime import UTC, datetime, timedelta

import pytest

from field_sync.envelope import GpsFix
from field_sync.exceptions import EventRejected
from releases.safety import PermitSafety, validate_permit_safety

NOW = datetime(2026, 5, 12, 12, tzinfo=UTC)
POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]],
        [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5], [0.5, 0.5]],
    ],
}


@pytest.mark.parametrize(
    ("at", "gps", "requirements", "code"),
    [
        (
            NOW + timedelta(days=1),
            GpsFix(0.2, 0.2, 5),
            {"max_gps_accuracy_m": 10},
            "release_permit_expired",
        ),
        (
            NOW - timedelta(days=2),
            GpsFix(0.2, 0.2, 5),
            {"max_gps_accuracy_m": 10},
            "release_permit_expired",
        ),
        (NOW, None, {"max_gps_accuracy_m": 10}, "release_gps_unusable"),
        (NOW, GpsFix(0.2, 0.2, None), {"max_gps_accuracy_m": 10}, "release_gps_unusable"),
        (NOW, GpsFix(0.2, 0.2, 10.01), {"max_gps_accuracy_m": 10}, "release_gps_unusable"),
        (NOW, GpsFix(0.2, 0.2, 0), {"max_gps_accuracy_m": 10}, "release_gps_unusable"),
        (NOW, GpsFix(3, 3, 5), {"max_gps_accuracy_m": 10}, "release_zone_invalid"),
        (NOW, GpsFix(1, 1, 5), {"max_gps_accuracy_m": 10}, "release_zone_invalid"),
        (NOW, GpsFix(0.2, 0.2, 5), {}, "release_configuration_unavailable"),
        (
            NOW,
            GpsFix(0.2, 0.2, 5),
            {"max_gps_accuracy_m": True},
            "release_configuration_unavailable",
        ),
    ],
)
def test_official_permit_safety_refuses_invalid_capture_without_override(
    at, gps, requirements, code
):
    permit = PermitSafety(NOW - timedelta(days=1), NOW + timedelta(days=1), POLYGON, requirements)
    with pytest.raises(EventRejected) as refused:
        validate_permit_safety(permit, at, gps)
    assert refused.value.code == code
    assert refused.value.params["severity"] == "critical"


def test_official_boundary_and_exact_accuracy_are_allowed():
    permit = PermitSafety(NOW, NOW + timedelta(days=1), POLYGON, {"max_gps_accuracy_m": 10})
    validate_permit_safety(permit, NOW, GpsFix(0, 0, 10))


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("kind", ["missing", "expired", "wrong_version"])
def test_release_handler_revalidates_actual_training_at_capture_and_receipt(
    kind, org_a, make_member, monkeypatch, settings, tmp_path
):
    from types import SimpleNamespace

    from releases.handlers import _training
    from tests.people_support import certify, people_context, require_training, training_version

    people = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    version = training_version(people)
    require_training(people, version)
    if kind != "missing":
        certify(people, version, end=NOW if kind == "expired" else NOW + timedelta(days=1))
    context = SimpleNamespace(
        organization=org_a,
        user=people.phone.user,
        server_received_at=NOW,
        envelope=SimpleNamespace(device_time=NOW),
    )
    permit = SimpleNamespace(center_id=people.center.pk, quadrant_id=people.quadrant.pk)
    declared = version.pk if kind != "wrong_version" else training_version(people, code="OTHER").pk
    with pytest.raises(EventRejected) as refused:
        _training(context, {"training_version": declared}, permit)
    assert refused.value.code == "release_training_invalid"
