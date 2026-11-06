"""One typed history contract for review decisions and whole-shift validation."""

from typing import Any

from rest_framework import serializers


class HistorySubjectSerializer(serializers.Serializer[Any]):
    center_id = serializers.UUIDField(allow_null=True)
    quadrant_id = serializers.UUIDField(allow_null=True)


class CourierHistoryEntrySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["review_decision", "shift_validation"])
    review_item_id = serializers.UUIDField(allow_null=True)
    source_event_id = serializers.UUIDField(allow_null=True)
    shift_id = serializers.UUIDField(allow_null=True)
    decision_kind = serializers.ChoiceField(
        choices=["accept", "void", "open_incident", "approve", "observe"]
    )
    revision = serializers.IntegerField(min_value=1)
    is_terminal = serializers.BooleanField(allow_null=True)
    decision_state = serializers.ChoiceField(
        choices=["pending", "accepted", "voided", "approved", "observed"]
    )
    reason = serializers.CharField()
    decided_by = serializers.UUIDField()
    decided_at = serializers.DateTimeField()
    subjects = HistorySubjectSerializer(many=True, allow_empty=False)
    source_status = serializers.ChoiceField(
        choices=["accepted", "in_review", "rejected"], allow_null=True
    )
    source_code = serializers.CharField(allow_null=True)
    effect_state = serializers.ChoiceField(
        choices=[
            "applied_review",
            "adopted_legacy",
            "discarded",
            "incident_open",
            "approved",
            "observed",
        ]
    )
    incident_id = serializers.UUIDField(allow_null=True)
    declared_void_target_uuid = serializers.UUIDField(allow_null=True)
    approval_current = serializers.BooleanField(allow_null=True)
