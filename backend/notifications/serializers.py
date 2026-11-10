"""W5 machine-only request and response contracts."""

from functools import cached_property
from typing import Any
from uuid import UUID

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from core.serializers import OrgScopedModelSerializer
from notifications.codes import CODE_KINDS
from notifications.models import Notification, NotificationKind
from notifications.references import safe_reference


class StrictSerializer(serializers.Serializer[Any]):
    def to_internal_value(self, data: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF boundary
        if isinstance(data, dict) and (unknown := data.keys() - self.fields.keys()):
            raise serializers.ValidationError(
                {
                    name: [ErrorDetail("Unknown field.", code="unknown_field")]
                    for name in sorted(unknown)
                }
            )
        return super().to_internal_value(data)


class NotificationQuerySerializer(StrictSerializer):
    cursor = serializers.CharField(required=False, max_length=4096)
    kind = serializers.ChoiceField(choices=NotificationKind.choices, required=False)
    unread = serializers.ChoiceField(choices=["true", "false"], required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=50)

    def validate_unread(self, value: str) -> bool:
        return value == "true"


class NotificationObjectReferenceSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=["incident", "motorcycle", "review_item"])
    available = serializers.BooleanField()
    id = serializers.UUIDField(allow_null=True)
    code = serializers.CharField(allow_null=True)
    is_voided = serializers.BooleanField(allow_null=True)


class NotificationSerializer(OrgScopedModelSerializer):
    code = serializers.ChoiceField(choices=list(CODE_KINDS), read_only=True)
    read_at = serializers.DateTimeField(allow_null=True, read_only=True)
    params = serializers.SerializerMethodField()
    object_ref = serializers.SerializerMethodField()

    @cached_property
    def _object_references(self) -> dict[UUID, dict[str, Any] | None]:
        return {}

    class Meta:
        model = Notification
        fields = ("id", "kind", "code", "params", "created_at", "read_at", "object_ref")
        read_only_fields = fields

    @extend_schema_field(serializers.DictField(child=serializers.JSONField()))
    def get_params(self, row: Notification) -> dict[str, Any]:
        reference = self.get_object_ref(row)
        if reference is None or not reference["available"]:
            return {}
        key = {"incident": "incident_id", "review_item": "review_item_id"}.get(row.object_kind)
        if key is None or row.params.get(key) != str(row.object_id):
            return {}
        return {key: str(row.object_id)}

    @extend_schema_field(NotificationObjectReferenceSerializer(allow_null=True))
    def get_object_ref(self, row: Notification) -> dict[str, Any] | None:
        references = self._object_references
        if row.pk not in references:
            references[row.pk] = safe_reference(row, self.context["member"])
        return references[row.pk]


@extend_schema_serializer(many=False)
class NotificationPageSerializer(serializers.Serializer[Any]):
    results = NotificationSerializer(many=True)
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    unread_total = serializers.IntegerField(min_value=0)


class NotificationPreferenceSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=NotificationKind.choices)
    in_app = serializers.BooleanField()
    email = serializers.BooleanField()
    required_in_app = serializers.BooleanField()
    required_email = serializers.BooleanField()


class NotificationPreferencesSerializer(serializers.Serializer[Any]):
    preferences = NotificationPreferenceSerializer(many=True)


class NotificationPreferencePatchSerializer(StrictSerializer):
    kind = serializers.ChoiceField(choices=NotificationKind.choices)
    in_app = serializers.BooleanField(required=False)
    email = serializers.BooleanField(required=False)


class NotificationPreferencesPatchSerializer(StrictSerializer):
    # DRF many_init forwards max_length to ListSerializer; the child stub omits it.
    preferences = NotificationPreferencePatchSerializer(  # type: ignore[call-arg]
        many=True, max_length=len(NotificationKind.values)
    )

    def validate_preferences(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len({row["kind"] for row in rows}) != len(rows):
            raise serializers.ValidationError("Duplicate kind.", code="duplicate_kind")
        return rows
