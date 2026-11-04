"""The API answers nulls where the committed OpenAPI schema says they are allowed."""

from pathlib import Path

import pytest
import yaml
from django.conf import settings

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
