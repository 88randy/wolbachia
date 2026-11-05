"""The writable fleet contract excludes client-controlled audit and block fields."""

from pathlib import Path

import pytest
import yaml
from django.conf import settings
from jsonschema import Draft4Validator

from core.exceptions import FieldValidationError
from shifts.models import Motorcycle
from shifts.motorcycle_serializers import MotorcycleSerializer, MotorcycleWriteSerializer
from shifts.services import update_motorcycle


def test_create_only_accepts_code_and_plate():
    payload = MotorcycleWriteSerializer(
        data={
            "code": " M-03 ",
            "plate": " TEST-03 ",
            "is_blocked": True,
            "blocked_reason": "out_of_service",
            "void_reason": "Client attempted correction",
            "created_by": "foreign-user",
            "organization": "foreign-org",
        }
    )
    assert payload.is_valid(), payload.errors
    assert payload.validated_data == {"code": "M-03", "plate": "TEST-03"}


@pytest.mark.parametrize("code", ["M-04", "M-03"])
def test_update_service_rejects_code_before_writing_even_without_a_serializer(code):
    motorcycle = Motorcycle(code="M-03", plate="TEST-03")

    with pytest.raises(FieldValidationError) as error:
        update_motorcycle(motorcycle, {"code": code, "plate": "TEST-04"})

    assert error.value.fields == {"code": [{"code": "immutable_code", "params": {}}]}


def test_unblocked_motorcycle_reason_is_allowed_by_the_published_schema_enum():
    motorcycle = Motorcycle(code="M-03")
    reason = MotorcycleSerializer(motorcycle).data["blocked_reason"]
    schema_path = Path(settings.BASE_DIR).parent / "packages/api-client/openapi.yaml"
    published = yaml.safe_load(schema_path.read_text(encoding="utf-8"))
    reason_schema = {
        "$ref": "#/components/schemas/Motorcycle/properties/blocked_reason",
        "components": published["components"],
    }

    assert reason == ""
    assert list(Draft4Validator(reason_schema).iter_errors(reason)) == []
