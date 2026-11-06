"""Validated queries over a history whose parent has already been authorized."""

from typing import Any

from django.db.models import QuerySet
from rest_framework import serializers


class VersionHistoryQuerySerializer(serializers.Serializer[Any]):
    created_by = serializers.UUIDField(required=False)
    effective_from_from = serializers.DateTimeField(required=False)
    effective_from_before = serializers.DateTimeField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start = attrs.get("effective_from_from")
        end = attrs.get("effective_from_before")
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError(
                {"effective_from_before": "Must be after effective_from_from."},
                code="invalid_range",
            )
        return attrs


REVISION_ORDERING = ["revision", "effective_from", "created_at", "created_by"]
POINT_ORDERING = ["version", "effective_from", "created_at", "created_by", "is_retired"]


class RevisionHistoryQuerySerializer(VersionHistoryQuerySerializer):
    revision = serializers.IntegerField(min_value=1, required=False)
    ordering = serializers.ChoiceField(
        choices=[*REVISION_ORDERING, *(f"-{field}" for field in REVISION_ORDERING)],
        default="-revision",
        help_text="One ordering field, optional - for descending; ties use id ascending.",
    )


class PointHistoryQuerySerializer(VersionHistoryQuerySerializer):
    version = serializers.IntegerField(min_value=1, required=False)
    is_retired = serializers.ChoiceField(choices=["true", "false"], required=False)
    ordering = serializers.ChoiceField(
        choices=[*POINT_ORDERING, *(f"-{field}" for field in POINT_ORDERING)],
        default="-version",
        help_text="One ordering field, optional - for descending; ties use id ascending.",
    )


def filter_version_history(versions: QuerySet[Any], query: dict[str, Any]) -> QuerySet[Any]:
    lookups = {
        "effective_from_from": "effective_from__gte",
        "effective_from_before": "effective_from__lt",
    }
    filters = {
        lookups.get(field, field): value == "true" if field == "is_retired" else value
        for field, value in query.items()
        if field != "ordering"
    }
    return versions.filter(**filters).order_by(query["ordering"], "id")
