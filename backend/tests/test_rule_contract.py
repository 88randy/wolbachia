"""Rule configuration and nullable API fields match their documented contracts."""

from decimal import Decimal
from pathlib import Path

import pytest
import yaml
from django.conf import settings

from core.exceptions import FieldValidationError
from rules.models import RuleParameter
from rules.seeds import DEFAULT_PARAMETER_SEEDS
from rules.services import validate_value
from tests.factories import RuleParameterFactory

SCHEMA_FILE = Path(settings.BASE_DIR).parent / "packages" / "api-client" / "openapi.yaml"
NULLABLE_FIELDS = [
    "value",
    "effective_from",
    "version_id",
    "next_change_at",
    "min_value",
    "max_value",
]


def seeded_pin_parameter() -> RuleParameter:
    seed = next((seed for seed in DEFAULT_PARAMETER_SEEDS if seed.key == "pin_max_attempts"), None)
    assert seed is not None, "PIN attempts must have a seeded definition"
    return RuleParameter(
        value_type=seed.value_type, min_value=seed.min_value, max_value=seed.max_value
    )


@pytest.mark.parametrize("value", ["1", "10"])
def test_pin_attempt_seed_accepts_the_inclusive_bounds(value) -> None:
    validate_value(seeded_pin_parameter(), Decimal(value))


@pytest.mark.parametrize(
    ("value", "code", "params"),
    [
        ("0", "out_of_range", {"min": 1, "max": 10}),
        ("11", "out_of_range", {"min": 1, "max": 10}),
        ("2.5", "not_an_integer", {}),
    ],
)
def test_pin_attempt_seed_rejects_invalid_values(value, code, params) -> None:
    parameter = seeded_pin_parameter()
    with pytest.raises(FieldValidationError) as error:
        validate_value(parameter, Decimal(value))

    assert error.value.fields == {"value": [{"code": code, "params": params}]}


@pytest.fixture(scope="module")
def parameter_schema() -> dict:
    schema = yaml.safe_load(SCHEMA_FILE.read_text(encoding="utf-8"))
    return schema["components"]["schemas"]["RuleParameter"]["properties"]


def is_nullable(prop: dict) -> bool:
    return prop.get("nullable") is True or any(
        option.get("nullable") is True for option in prop.get("allOf", [])
    )


@pytest.mark.parametrize("field", NULLABLE_FIELDS)
def test_schema_declares_the_nullable_fields_of_a_rule_parameter(parameter_schema, field) -> None:
    assert is_nullable(parameter_schema[field])


@pytest.mark.django_db
def test_parameter_without_version_or_scheduled_change_serializes_nulls(
    api_client, org_a, make_member
) -> None:
    from rules import permissions

    user, _ = make_member(org_a, [permissions.RULE_PARAMETER_READ])
    api_client.force_authenticate(user)
    RuleParameterFactory(organization=org_a, key="session_idle_minutes")

    [row] = api_client.get("/api/v1/rule-parameters/").data["results"]

    assert {field: row[field] for field in NULLABLE_FIELDS if field != "min_value"} == {
        "value": None,
        "effective_from": None,
        "version_id": None,
        "next_change_at": None,
        "max_value": None,
    }
    assert row["min_value"] is None
