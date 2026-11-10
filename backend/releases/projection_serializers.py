"""The permit payload is shared by bootstrap and its canonical change writer."""

from typing import Any

from rest_framework import serializers


class ReleaseCaptureCustodySerializer(serializers.Serializer[Any]):
    receipt_line_id = serializers.UUIDField()
    receipt_source_event_id = serializers.UUIDField()
    assignment_id = serializers.UUIDField()
    assignment_date = serializers.DateField()
    shift_id = serializers.UUIDField(allow_null=True)
    unit_version_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True)
    available_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    accounted_release_event_ids = serializers.ListField(child=serializers.UUIDField())
    received_at = serializers.DateTimeField()
    source_lot_version_id = serializers.UUIDField()
    current_lot_version_id = serializers.UUIDField()
    source_expires_at = serializers.DateTimeField(allow_null=True)
    current_expires_at = serializers.DateTimeField(allow_null=True)
    transit_policy_id = serializers.UUIDField(allow_null=True)
    transit_mode = serializers.CharField(allow_null=True)
    proof_roles = serializers.ListField(child=serializers.CharField())
    requires_evidence = serializers.BooleanField()
    blocked_by = serializers.ListField(child=serializers.CharField())


class ReleaseCaptureDeviceSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    status = serializers.ChoiceField(choices=("active", "inactive", "retired"))
    revision = serializers.IntegerField(min_value=1)
    created_at = serializers.DateTimeField()
    source_lot_id = serializers.UUIDField()
    source_lot_version_id = serializers.UUIDField()
    custody = ReleaseCaptureCustodySerializer(many=True)


class ReleaseCaptureTaskSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    point_id = serializers.UUIDField()
    permit_id = serializers.UUIDField()
    permit_version_id = serializers.UUIDField()
    courier_id = serializers.UUIDField()
    due_date = serializers.DateField()
    owner_revision = serializers.IntegerField(min_value=1)
    is_completed = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    binding_created_at = serializers.DateTimeField()
    owner_created_at = serializers.DateTimeField()


class ReleaseCaptureBundleSerializer(serializers.Serializer[Any]):
    as_of = serializers.DateTimeField()
    version = serializers.CharField()
    devices = ReleaseCaptureDeviceSerializer(many=True)
    tasks = ReleaseCaptureTaskSerializer(many=True)


class PermitBundleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    version = serializers.CharField()
    permit_version_id = serializers.UUIDField(allow_null=True)
    permit_type_id = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField(min_value=1)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField()
    geometry = serializers.JSONField(allow_null=True)
    valid_from = serializers.DateTimeField(allow_null=True)
    valid_to = serializers.DateTimeField(allow_null=True)
    requirements = serializers.JSONField()
    blocked_by = serializers.ListField(child=serializers.CharField())
    capture = ReleaseCaptureBundleSerializer(allow_null=True)
