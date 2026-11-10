"""Optional read-only capture facts shared by bootstrap and sync, never a new transport."""

from typing import Any

from rest_framework import serializers


class SampleCaptureVerificationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    decision = serializers.ChoiceField(choices=["verify"])
    content_hash = serializers.RegexField(r"^[0-9a-f]{64}$")
    created_at = serializers.DateTimeField()


class SampleCaptureMethodSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    method_id = serializers.UUIDField()
    label = serializers.CharField()  # type: ignore[assignment]
    revision = serializers.IntegerField(min_value=1)
    created_at = serializers.DateTimeField()
    effective_from = serializers.DateTimeField()
    content_hash = serializers.RegexField(r"^[0-9a-f]{64}$")
    supports_wolbachia = serializers.BooleanField()
    verification = SampleCaptureVerificationSerializer()


class SampleCaptureSourceSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=["reading", "lot", "release"])
    id = serializers.UUIDField()
    label = serializers.CharField()  # type: ignore[assignment]
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    author_id = serializers.UUIDField(allow_null=True)
    event_id = serializers.UUIDField(allow_null=True)
    device_time = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()
    effective = serializers.BooleanField()
    lot_version_id = serializers.UUIDField(allow_null=True)
    lot_version_revision = serializers.IntegerField(min_value=1, allow_null=True)
    lot_version_created_at = serializers.DateTimeField(allow_null=True)


class SampleCaptureReceiptSerializer(serializers.Serializer[Any]):
    sample_id = serializers.UUIDField()
    event_id = serializers.UUIDField()
    received_at = serializers.DateTimeField()


class SampleCaptureSnapshotSerializer(serializers.Serializer[Any]):
    schema_version = serializers.IntegerField(min_value=1, max_value=1)
    organization_id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    version = serializers.RegexField(r"^[0-9a-f]{64}$")
    as_of = serializers.DateTimeField()
    valid_until = serializers.DateTimeField(allow_null=True)
    methods = SampleCaptureMethodSerializer(many=True)
    sources = SampleCaptureSourceSerializer(many=True)
    receipts = SampleCaptureReceiptSerializer(many=True)
