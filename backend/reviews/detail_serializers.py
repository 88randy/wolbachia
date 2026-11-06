"""Typed immutable inspection projections; internal cross-source GPS facts are never exported."""

from typing import Any

from rest_framework import serializers

from reviews.history_serializers import HistorySubjectSerializer


class ReviewEvaluationSerializer(serializers.Serializer[Any]):
    can_accept = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
    legacy_state = serializers.ChoiceField(
        choices=["none", "complete_owned", "partial", "ambiguous", "unavailable"]
    )
    subjects = HistorySubjectSerializer(many=True)
    scope_resolved = serializers.BooleanField()
    authority_proof_ids = serializers.ListField(child=serializers.UUIDField())


class ReviewStateSerializer(serializers.Serializer[Any]):
    revision = serializers.IntegerField(min_value=0)
    kind = serializers.ChoiceField(choices=["pending", "accepted", "voided"])
    latest_kind = serializers.ChoiceField(
        choices=["accept", "void", "open_incident"], allow_null=True
    )
    audit_only = serializers.BooleanField()
    terminal = serializers.BooleanField()


class OriginalGpsSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    accuracy_m = serializers.FloatField(allow_null=True)


class OriginalEnvelopeSerializer(serializers.Serializer[Any]):
    unavailable = serializers.BooleanField(required=False)
    version = serializers.IntegerField(required=False)
    id = serializers.UUIDField(required=False)
    type = serializers.CharField(required=False)
    schema_version = serializers.IntegerField(required=False)
    device_time = serializers.DateTimeField(required=False)
    payload_sha256 = serializers.CharField(required=False)
    rules_version = serializers.CharField(required=False, allow_blank=True)
    catalog_version = serializers.CharField(required=False, allow_blank=True)
    manual_capture = serializers.BooleanField(required=False)
    shift_id = serializers.UUIDField(required=False, allow_null=True)
    gps = OriginalGpsSerializer(required=False, allow_null=True)
    declared_void_target_uuid = serializers.UUIDField(required=False, allow_null=True)


class CapturedProvenanceSerializer(serializers.Serializer[Any]):
    snapshot_id = serializers.UUIDField(allow_null=True)
    policy_version = serializers.CharField(allow_null=True)
    point_version_id = serializers.UUIDField(allow_null=True)
    rule_version_ids = serializers.DictField(child=serializers.UUIDField())
    rule_values = serializers.DictField(child=serializers.FloatField(allow_null=True))
    fuel_baseline_id = serializers.UUIDField(allow_null=True)
    fuel_context_available = serializers.BooleanField(allow_null=True)


class OriginalReviewEventSerializer(serializers.Serializer[Any]):
    envelope = OriginalEnvelopeSerializer()
    payload = serializers.JSONField()
    server_received_at = serializers.DateTimeField()
    clock_skew_seconds = serializers.IntegerField(allow_null=True)
    voided_at = serializers.DateTimeField(allow_null=True)
    provenance = CapturedProvenanceSerializer()


class ShiftValidationSerializer(serializers.Serializer[Any]):
    revision = serializers.IntegerField(min_value=0)
    latest_decision = serializers.UUIDField(allow_null=True)
    kind = serializers.ChoiceField(choices=["approve", "observe"], allow_null=True)
    approval_current = serializers.BooleanField()
    blockers = serializers.ListField(child=serializers.CharField())
