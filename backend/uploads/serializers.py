"""Explicit public schemas never expose private keys or internal storage receipts."""

from typing import Any

from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer
from uploads.limits import CONTENT_TYPES, max_upload_bytes


class AttachmentTargetSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(
        choices=[
            "field_event",
            "motorcycle_fault",
            "incident",
            "review_item",
            "transfer_event",
            "lab_rejection",
            "inventory_intent",
            "certification",
            "lab_paddle_command",
            "material_request",
        ]
    )
    id = serializers.UUIDField()


class EvidenceUploadRequestSerializer(StrictPayloadSerializer):
    content_type = serializers.CharField()
    size_bytes = serializers.IntegerField(min_value=1)
    sha256 = serializers.RegexField(r"^[0-9a-fA-F]{64}$")
    client_id = serializers.UUIDField(required=False)
    # DRF removes declared fields from the class; this is not its internal context property.
    context = AttachmentTargetSerializer(required=False)  # type: ignore[assignment]

    def validate_content_type(self, value: str) -> str:
        if value not in CONTENT_TYPES:
            raise serializers.ValidationError("Type not allowed.", code="upload_type_not_allowed")
        return value

    def validate_size_bytes(self, value: int) -> int:
        if value > max_upload_bytes():
            raise serializers.ValidationError("File too large.", code="upload_too_large")
        return value

    def validate_sha256(self, value: str) -> str:
        return value.lower()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if (
            attrs.get("context", {}).get("kind") in {"field_event", "inventory_intent"}
            and "client_id" not in attrs
        ):
            raise serializers.ValidationError(
                {
                    "client_id": [
                        serializers.ErrorDetail("Use the declared capture UUID.", code="required")
                    ]
                }
            )
        return attrs


class UploadFinalizeSerializer(StrictPayloadSerializer):
    context = AttachmentTargetSerializer(required=False)  # type: ignore[assignment]


class UploadAuthorizationSerializer(serializers.Serializer[Any]):
    upload_id = serializers.UUIDField()
    url = serializers.CharField()
    method = serializers.ChoiceField(choices=["PUT"])
    headers = serializers.DictField(child=serializers.CharField())
    expires_at = serializers.DateTimeField()


class UploadStatusSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    state = serializers.ChoiceField(choices=["authorized", "received", "verified"])
    verified_at = serializers.DateTimeField(allow_null=True)


class UploadRenewalSerializer(UploadStatusSerializer, UploadAuthorizationSerializer):
    pass
