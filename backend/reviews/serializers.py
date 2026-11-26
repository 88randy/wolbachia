from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from core.void_reason import validate_void_reason
from ovitraps.payloads import StrictPayloadSerializer
from reviews.detail_serializers import (
    OriginalReviewEventSerializer,
    ReviewEvaluationSerializer,
    ReviewStateSerializer,
)
from reviews.models import (
    CODE_MAX_LENGTH,
    ReviewDecision,
    ReviewEffectReceipt,
    ReviewItem,
    ReviewKind,
    ReviewSafetyDisposition,
    ShiftDecision,
)


class ReviewItemSerializer(OrgScopedModelSerializer):
    """A review item for the supervisor's list: what was flagged, why (`code` + `params`) and who
    sent it. The event itself (payload, times) comes with the review screens of #22."""

    event_id = serializers.UUIDField(source="field_event_id", read_only=True)

    class Meta:
        model = ReviewItem
        fields = [
            "id",
            "event_id",
            "event_type",
            "kind",
            "code",
            "params",
            "courier",
            "device",
            "created_at",
        ]
        read_only_fields = fields


class ReviewItemFilterSerializer(serializers.Serializer[Any]):
    """Query parameters of `GET /review-items/`."""

    kind = serializers.ChoiceField(choices=ReviewKind.choices, required=False)
    code = serializers.CharField(max_length=CODE_MAX_LENGTH, required=False)


class ReviewDecisionRequestSerializer(StrictPayloadSerializer):
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)
    expected_revision = serializers.IntegerField(min_value=0)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=100, default=list
    )

    def validate_reason(self, value: str) -> str:
        return validate_void_reason(value, "reason")

    def validate_evidence_ids(self, value: list) -> list:
        if len(set(value)) != len(value):
            raise serializers.ValidationError(
                "Use unique evidence UUIDs.", code="duplicate_evidence"
            )
        return value


class SafetyDispositionRequestSerializer(StrictPayloadSerializer):
    inspection_id = serializers.UUIDField()
    attest_safe_now = serializers.BooleanField()

    def validate_attest_safe_now(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError("A current attestation is required.")
        return value


class ReviewVoidRequestSerializer(ReviewDecisionRequestSerializer):
    safety_disposition = SafetyDispositionRequestSerializer(required=False)


class ShiftDecisionRequestSerializer(StrictPayloadSerializer):
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)
    expected_revision = serializers.IntegerField(min_value=0)

    def validate_reason(self, value: str) -> str:
        return validate_void_reason(value, "reason")


class ReviewSafetyDispositionSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ReviewSafetyDisposition
        fields = [
            "id",
            "source_event",
            "review_item",
            "decision",
            "motorcycle",
            "inspection",
            "evidence_ids",
            "inspection_snapshot",
            "policy_version",
            "attest_safe_now",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReviewEffectReceiptSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ReviewEffectReceipt
        fields = [
            "id",
            "source_event",
            "decision",
            "mode",
            "payload_sha256",
            "handler_version",
            "materialization",
            "authority_proofs",
            "observations",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReviewDecisionSerializer(OrgScopedModelSerializer):
    decision_state = serializers.ChoiceField(
        choices=["pending", "accepted", "voided"], read_only=True
    )
    audit_only = serializers.BooleanField(read_only=True)
    safety_disposition = ReviewSafetyDispositionSerializer(read_only=True, allow_null=True)
    incident_id = serializers.SerializerMethodField()
    incident_code = serializers.SerializerMethodField()
    evaluation = ReviewEvaluationSerializer(read_only=True)
    effect_receipt = ReviewEffectReceiptSerializer(read_only=True, allow_null=True)

    class Meta:
        model = ReviewDecision
        fields = [
            "id",
            "review_item",
            "revision",
            "expected_revision",
            "is_terminal",
            "decision_state",
            "audit_only",
            "kind",
            "reason",
            "evidence_ids",
            "evaluation",
            "created_by",
            "created_at",
            "safety_disposition",
            "incident_id",
            "incident_code",
            "effect_receipt",
        ]
        read_only_fields = fields

    def get_incident_id(self, obj: ReviewDecision) -> str | None:
        from reviews.models import ReviewIncidentLink

        link = ReviewIncidentLink.objects.filter(decision=obj).first()
        return None if link is None else str(link.incident_id)

    def get_incident_code(self, obj: ReviewDecision) -> str | None:
        from reviews.models import ReviewIncidentLink

        link = ReviewIncidentLink.objects.filter(decision=obj).select_related("incident").first()
        return None if link is None else link.incident.code


class ShiftDecisionSerializer(OrgScopedModelSerializer):
    class Meta:
        model = ShiftDecision
        fields = [
            "id",
            "shift",
            "closed_event",
            "revision",
            "expected_revision",
            "kind",
            "reason",
            "validation_fingerprint",
            "subjects",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReviewItemDetailSerializer(ReviewItemSerializer):
    ingest_status = serializers.CharField(source="field_event.status", read_only=True)
    decision_state = serializers.SerializerMethodField()
    evaluation = serializers.SerializerMethodField()
    original_event = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()

    class Meta(ReviewItemSerializer.Meta):
        fields = [
            *ReviewItemSerializer.Meta.fields,
            "ingest_status",
            "decision_state",
            "evaluation",
            "original_event",
            "timeline",
        ]
        read_only_fields = fields

    @extend_schema_field(ReviewStateSerializer)
    def get_decision_state(self, obj: ReviewItem) -> dict[str, Any]:
        latest = obj.decisions.order_by("-revision").first()
        return {
            "revision": 0 if latest is None else latest.revision,
            "kind": "pending" if latest is None else latest.decision_state,
            "latest_kind": None if latest is None else latest.kind,
            "audit_only": latest is not None and latest.audit_only,
            "terminal": latest is not None and latest.is_terminal,
        }

    @extend_schema_field(ReviewDecisionSerializer(many=True))
    def get_timeline(self, obj: ReviewItem) -> list[dict[str, Any]]:
        return list(ReviewDecisionSerializer(obj.decisions.order_by("revision"), many=True).data)

    @extend_schema_field(ReviewEvaluationSerializer)
    def get_evaluation(self, obj: ReviewItem) -> dict[str, Any]:
        from reviews.evaluation import evaluation_payload, inspect_review

        return evaluation_payload(inspect_review(obj.field_event))

    @extend_schema_field(OriginalReviewEventSerializer)
    def get_original_event(self, obj: ReviewItem) -> dict[str, Any]:
        from reviews.inspection import original_source_envelope
        from reviews.source_identity import envelope_metadata

        source = obj.field_event
        try:
            original = envelope_metadata(original_source_envelope(source))
        except ValueError:
            original = {"unavailable": True}
        return {
            "envelope": original,
            "payload": source.payload,
            "server_received_at": source.server_received_at.isoformat(),
            "clock_skew_seconds": source.clock_skew_seconds,
            "voided_at": None if source.voided_at is None else source.voided_at.isoformat(),
            "provenance": _captured_provenance(obj),
        }


def _captured_provenance(item: ReviewItem) -> dict[str, Any]:
    from reviews.models import ReviewSourceSnapshot

    snapshot = ReviewSourceSnapshot.objects.filter(source_event_id=item.field_event_id).first()
    owner = {} if snapshot is None else snapshot.facts.get("owner", {})
    capture, fuel = owner.get("ovitrap", {}), owner.get("fuel", {})
    baseline = fuel.get("baseline")
    thresholds = fuel.get("thresholds", {})
    return {
        "snapshot_id": None if snapshot is None else str(snapshot.pk),
        "policy_version": None if snapshot is None else snapshot.policy_version,
        "point_version_id": capture.get("point_version_id"),
        "rule_version_ids": capture.get("rule_version_ids", {})
        or {
            key: value["version_id"]
            for key, value in thresholds.get("rule_provenance", {}).items()
            if value.get("version_id") is not None
        },
        "rule_values": capture.get("rules", {})
        or {
            key: value.get("value") for key, value in thresholds.get("rule_provenance", {}).items()
        },
        "fuel_baseline_id": None if baseline is None else baseline["id"],
        "fuel_context_available": fuel.get("available"),
    }
