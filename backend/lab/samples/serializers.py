"""Explicit response schema for authorized immutable sample projections."""

from typing import Any

from rest_framework import serializers

from lab.samples.payloads import CollectSampleSerializer as CollectSampleSerializer
from lab.samples.payloads import SampleResultSerializer as SampleResultSerializer
from lab.serializers import LabMethodPinSerializer


class SampleQuerySerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    include_voided = serializers.BooleanField(required=False, default=False)
    pending_result = serializers.BooleanField(required=False, default=False)


class SampleReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    command_id = serializers.UUIDField()
    receiver_id = serializers.UUIDField()
    created_at = serializers.DateTimeField()


class SampleAttemptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    command_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=["valid", "invalid", "disputed"])
    result = serializers.ChoiceField(choices=["positive", "negative"], allow_null=True)
    method_version_id = serializers.UUIDField()
    method = LabMethodPinSerializer()
    method_verification_id = serializers.UUIDField()
    repeat_of = serializers.UUIDField(allow_null=True)
    author_id = serializers.UUIDField()
    created_at = serializers.DateTimeField()


class SampleCommandOutcomeSerializer(serializers.Serializer[Any]):
    sample_id = serializers.UUIDField()
    receipt = SampleReceiptSerializer(allow_null=True)
    attempt = SampleAttemptSerializer(allow_null=True)


class SampleSnapshotSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    event_id = serializers.UUIDField()
    origin_snapshot = serializers.JSONField()
    other_text = serializers.CharField(allow_blank=True)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    reading_id = serializers.UUIDField(allow_null=True)
    lot_id = serializers.UUIDField(allow_null=True)
    release_id = serializers.UUIDField(allow_null=True)
    method_version_id = serializers.UUIDField()
    method = LabMethodPinSerializer()
    location = serializers.JSONField()
    source_provenance = serializers.JSONField()
    device_time = serializers.DateTimeField()
    server_received_at = serializers.DateTimeField()
    collector_id = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    voided = serializers.BooleanField()
    receipt = SampleReceiptSerializer(allow_null=True)
    attempts = SampleAttemptSerializer(many=True)
    selected_valid_result = SampleAttemptSerializer(allow_null=True)
    result_status = serializers.ChoiceField(
        choices=["missing", "invalid", "disputed", "positive", "negative"]
    )
    numerator_eligible = serializers.BooleanField()
    denominator_eligible = serializers.BooleanField()
