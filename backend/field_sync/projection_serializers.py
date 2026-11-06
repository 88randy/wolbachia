"""Concrete courier projections, shared by snapshot and change payloads."""

from typing import Any

from rest_framework import serializers


class QuadrantReferenceSerializer(serializers.Serializer[Any]):
    resource_type = serializers.ChoiceField(choices=["quadrant", "block"])
    id = serializers.UUIDField()
    code = serializers.CharField()
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)


class SamplingPointBundleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    block_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField()
    location = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    is_retired = serializers.BooleanField()
    version = serializers.IntegerField(min_value=1)


class OvitrapBundleSerializer(serializers.Serializer[Any]):
    # Additive schema-1 field: older snapshots/producers imply no retirement.
    is_retired = serializers.BooleanField(required=False, default=False)
    version = serializers.CharField()
    id = serializers.UUIDField()
    client_uuid = serializers.UUIDField()
    code = serializers.CharField()
    sampling_point_id = serializers.UUIDField()
    point_version = serializers.UUIDField()
    sampling_point_version = serializers.IntegerField(min_value=1)
    placed_at = serializers.DateTimeField()
    reading_id = serializers.UUIDField(allow_null=True)
    finding_code = serializers.CharField(allow_null=True)
    paddle_present = serializers.BooleanField(allow_null=True)
    has_eggs = serializers.BooleanField(allow_null=True)
    checked_at = serializers.DateTimeField(allow_null=True)
    is_lagged = serializers.BooleanField(allow_null=True)
    placement_voided = serializers.BooleanField()
    voided = serializers.BooleanField()
    voided_resource_type = serializers.ChoiceField(
        choices=["placement", "reading"], allow_null=True
    )
    voided_event_id = serializers.UUIDField(allow_null=True)
    void_reason_code = serializers.CharField(allow_blank=True)
    voided_at = serializers.DateTimeField(allow_null=True)
