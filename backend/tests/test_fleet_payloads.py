"""Fuel input contract, without PostgreSQL."""

import pytest

from fleet.payloads import FuelLoadPayloadSerializer


@pytest.mark.parametrize("field", ["litres", "amount"])
@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", "0", "-1"])
def test_fuel_requires_positive_finite_values(field, value):
    payload = {
        "motorcycle_id": "M-03",
        "litres": "1.000",
        "amount": "25.00",
        "currency": "MXN",
        "odometer_km": 12000,
        "receipt_upload_id": None,
        "is_full_refill": True,
        field: value,
    }
    serializer = FuelLoadPayloadSerializer(data=payload)
    assert not serializer.is_valid()
    assert field in serializer.errors


def test_schema_one_identifier_is_a_code_and_receipt_is_explicit():
    serializer = FuelLoadPayloadSerializer(
        data={
            "motorcycle_id": "M-03",
            "litres": "1.000",
            "amount": "25.00",
            "currency": "MXN",
            "odometer_km": 999999,
            "receipt_upload_id": None,
            "is_full_refill": False,
        }
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["motorcycle_id"] == "M-03"
    assert serializer.validated_data["receipt_upload_id"] is None


def test_service_due_date_cannot_overflow_the_published_date_contract():
    from core.exceptions import FieldValidationError
    from fleet.serializers import ServiceWriteSerializer

    serializer = ServiceWriteSerializer(
        data={
            "kind": "routine",
            "performed_at": "9999-12-31",
            "odometer_km": 10,
            "service_interval_days": 1,
        }
    )
    with pytest.raises(FieldValidationError) as error:
        serializer.is_valid(raise_exception=True)
    assert error.value.fields == {"service_interval_days": [{"code": "out_of_range", "params": {}}]}
