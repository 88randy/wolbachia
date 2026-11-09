"""Canonical command identity and aggregate wording rules; no guessed PII detector."""

import json
from datetime import date, datetime
from hashlib import sha256
from typing import Any
from uuid import UUID

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from core.validation import params_message
from core.void_reason import VOID_REASON_TOO_SHORT, validate_void_reason, visible_length

CATALOG_SLUG = "community-activity-type"
CREATE = "community_activity.create"
READ = "community_activity.read"
VOID = "community_activity.void"
SOURCE_TYPE = "community.activity"


def normalize_void_reason(reason: str) -> str:
    """B34 always requires ten visible characters, independently of a lower global minimum."""
    cleaned = validate_void_reason(reason, "reason", enforce_minimum=False)
    if visible_length(cleaned) < 10:
        raise serializers.ValidationError(
            {
                "reason": [
                    ErrorDetail(params_message({"min_length": 10}), code=VOID_REASON_TOO_SHORT)
                ]
            }
        )
    return cleaned


def json_value(value: Any) -> Any:  # noqa: ANN401 -- canonical validated command JSON
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    if isinstance(value, (UUID, date, datetime)):
        return str(value) if isinstance(value, UUID) else value.isoformat()
    return value


def command_hash(actor_id: UUID, operation: str, values: dict[str, Any]) -> str:
    """Values include origin, target, body and exact genuine source identity when present."""
    frame = {"actor_id": str(actor_id), "operation": operation, "values": json_value(values)}
    return sha256(json.dumps(frame, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_words(payload: dict[str, Any], historical: dict[str, Any]) -> None:
    is_other = historical.get("is_other") is True or historical.get("code") == "other"
    has_other = visible_length(payload["other_text"]) > 0
    if is_other != has_other or (not is_other and payload["other_text"]):
        raise serializers.ValidationError(
            {"other_text": ["required_for_other" if is_other else "forbidden"]}
        )
    if payload.get("incident_id") is not None and not visible_length(payload["agreements"]):
        raise serializers.ValidationError({"agreements": ["required_for_incident_link"]})
