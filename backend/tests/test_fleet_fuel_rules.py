"""Fuel threshold/provenance consistency without PostgreSQL or timing dependencies."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from fleet.fuel_services import MAX_KEY, MIN_KEY, _thresholds


@pytest.mark.parametrize("current_minimum", [Decimal("20.000"), None])
def test_fuel_thresholds_use_the_value_of_the_recorded_version(monkeypatch, current_minimum):
    effective_from = datetime(2026, 11, 5, tzinfo=UTC)
    minimum_version = None if current_minimum is None else uuid.uuid4()
    maximum_version = uuid.uuid4()
    # A separate values read would see 15 before publication; the annotated rows see 20.
    context = SimpleNamespace(
        organization=object(),
        envelope=SimpleNamespace(device_time=effective_from),
        rules_at=Mock(return_value={MIN_KEY: 15, MAX_KEY: 60}),
    )
    parameters = Mock()
    parameters.filter.return_value.values.return_value = [
        {
            "key": MIN_KEY,
            "value_type": "decimal",
            "current_value": current_minimum,
            "current_version_id": minimum_version,
            "current_effective_from": None if current_minimum is None else effective_from,
        },
        {
            "key": MAX_KEY,
            "value_type": "decimal",
            "current_value": Decimal("60.000"),
            "current_version_id": maximum_version,
            "current_effective_from": effective_from,
        },
    ]
    monkeypatch.setattr(
        "fleet.fuel_services.list_parameters_with_current", Mock(return_value=parameters)
    )

    thresholds = _thresholds(context)

    assert thresholds["threshold_min"] == current_minimum
    assert thresholds["threshold_max"] == Decimal("60.000")
    assert thresholds["rule_provenance"] == {
        MIN_KEY: {
            "version_id": None if minimum_version is None else str(minimum_version),
            "value": None if current_minimum is None else float(current_minimum),
            "effective_from": None if current_minimum is None else effective_from.isoformat(),
        },
        MAX_KEY: {
            "version_id": str(maximum_version),
            "value": 60.0,
            "effective_from": effective_from.isoformat(),
        },
    }
    context.rules_at.assert_not_called()
