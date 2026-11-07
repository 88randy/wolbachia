"""One typed history contract for review decisions and whole-shift validation."""

from typing import Any

from drf_spectacular.extensions import OpenApiSerializerExtension
from rest_framework import serializers


class HistorySubjectSerializer(serializers.Serializer[Any]):
    center_id = serializers.UUIDField(allow_null=True)
    quadrant_id = serializers.UUIDField(allow_null=True)


class ReviewHistoryEntrySerializer(serializers.Serializer[Any]):
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


class RelocationHistoryDecisionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    decision = serializers.ChoiceField(choices=["approved", "rejected"])
    reason = serializers.CharField(allow_null=True)
    decided_at = serializers.DateTimeField(allow_null=True)
    published_point_version = serializers.UUIDField(allow_null=True)


class RelocationHistoryTaskSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    due_date = serializers.DateField()


class RelocationHistoryEntrySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["relocation_proposal"])
    proposal_event_id = serializers.UUIDField()
    point_id = serializers.UUIDField()
    point_code = serializers.CharField()
    status = serializers.ChoiceField(choices=["pending", "approved", "rejected"])
    proposed_location = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2
    )
    decision = RelocationHistoryDecisionSerializer(allow_null=True)
    next_day_task = RelocationHistoryTaskSerializer(allow_null=True)
    source_voided_at = serializers.DateTimeField(allow_null=True)
    subjects = HistorySubjectSerializer(many=True, allow_empty=False)


class TransferHistoryEntrySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["transfer_custody"])
    transfer_id = serializers.UUIDField()
    transfer_code = serializers.CharField()
    phase = serializers.ChoiceField(choices=["dispatch", "receive"])
    revision = serializers.IntegerField(min_value=1)
    manifest_hash = serializers.CharField()
    source_event_id = serializers.UUIDField()
    source_status = serializers.ChoiceField(choices=["accepted", "in_review", "rejected"])
    source_code = serializers.CharField()
    voided_at = serializers.DateTimeField(allow_null=True)
    subjects = HistorySubjectSerializer(many=True, allow_empty=False)


class LabHistoryEntrySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(
        choices=["lab_receipt", "lab_discrepancy", "lab_count", "lab_void", "lab_rejection"]
    )
    bag_id = serializers.UUIDField(allow_null=True)
    count_id = serializers.UUIDField(allow_null=True)
    rejection_id = serializers.UUIDField(allow_null=True)
    reading_id = serializers.UUIDField()
    source_event_id = serializers.UUIDField()
    recorded_at = serializers.DateTimeField()
    author_id = serializers.UUIDField()
    source_device_time = serializers.DateTimeField()
    source_server_received_at = serializers.DateTimeField()
    subjects = HistorySubjectSerializer(many=True, allow_empty=False)
    value = serializers.IntegerField(allow_null=True)
    viability_percent = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    qa_state = serializers.ChoiceField(
        choices=["not_requested", "awaiting_independent_qa", "superseded"]
    )
    voided = serializers.BooleanField()
    incident_id = serializers.UUIDField(allow_null=True)
    configuration_pending = serializers.BooleanField()
    method_version_id = serializers.UUIDField(allow_null=True)
    reason = serializers.CharField(allow_null=True, allow_blank=True)


class CommunityHistoryEntrySerializer(serializers.Serializer[Any]):
    from community.serializers import CommunityTypeSnapshotSerializer

    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["community_activity"])
    activity_id = serializers.UUIDField()
    event_id = serializers.UUIDField()
    command_id = serializers.UUIDField()
    code = serializers.CharField()
    revision = serializers.IntegerField(min_value=1, max_value=2)
    type_id = serializers.UUIDField()
    type_snapshot = CommunityTypeSnapshotSerializer()
    zone_id = serializers.UUIDField()
    zone_version_id = serializers.UUIDField()
    activity_date = serializers.DateField()
    attendance = serializers.IntegerField(min_value=0, max_value=2**53 - 1)
    is_voided = serializers.BooleanField()
    source_event_id = serializers.UUIDField()
    source_device_time = serializers.DateTimeField()
    source_server_received_at = serializers.DateTimeField()
    subjects = HistorySubjectSerializer(many=True, allow_empty=False)


class CourierHistoryEntrySerializer(serializers.Serializer[Any]):
    """The single history producer validates and renders its two actual domain shapes."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF protocol
        serializer = self._serializer(data.get("kind"))(data=data)
        serializer.is_valid(raise_exception=True)
        return dict(serializer.validated_data)

    def to_representation(self, instance: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF protocol
        return dict(self._serializer(instance.get("kind"))(instance).data)

    @staticmethod
    def _serializer(kind: str) -> type[serializers.Serializer[Any]]:
        if kind == "community_activity":
            return CommunityHistoryEntrySerializer
        if isinstance(kind, str) and kind in {
            "lab_receipt",
            "lab_discrepancy",
            "lab_count",
            "lab_void",
            "lab_rejection",
        }:
            return LabHistoryEntrySerializer
        if kind == "transfer_custody":
            return TransferHistoryEntrySerializer
        if kind == "relocation_proposal":
            return RelocationHistoryEntrySerializer
        if kind in {"review_decision", "shift_validation"}:
            return ReviewHistoryEntrySerializer
        raise serializers.ValidationError({"kind": ["invalid_choice"]})


class CourierHistorySchema(OpenApiSerializerExtension):
    target_class = CourierHistoryEntrySerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- schema extension protocol
        review = auto_schema.resolve_serializer(ReviewHistoryEntrySerializer(), direction).ref
        relocation = auto_schema.resolve_serializer(
            RelocationHistoryEntrySerializer(), direction
        ).ref
        transfer = auto_schema.resolve_serializer(TransferHistoryEntrySerializer(), direction).ref
        lab = auto_schema.resolve_serializer(LabHistoryEntrySerializer(), direction).ref
        community = auto_schema.resolve_serializer(CommunityHistoryEntrySerializer(), direction).ref
        return {
            "oneOf": [review, relocation, transfer, lab, community],
            "discriminator": {
                "propertyName": "kind",
                "mapping": {
                    "community_activity": community["$ref"],
                    "review_decision": review["$ref"],
                    "shift_validation": review["$ref"],
                    "relocation_proposal": relocation["$ref"],
                    "transfer_custody": transfer["$ref"],
                    **{
                        kind: lab["$ref"]
                        for kind in (
                            "lab_receipt",
                            "lab_discrepancy",
                            "lab_count",
                            "lab_void",
                            "lab_rejection",
                        )
                    },
                },
            },
        }
