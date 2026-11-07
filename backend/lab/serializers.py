"""Structural input validation never consults today's mutable method or result state."""

from typing import Any

from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail

from core.filters import CodeQuerySerializer
from core.serializers import OrgScopedModelSerializer
from lab.models import (
    LabMethod,
    LabMethodVerification,
    LabMethodVersion,
    ReceptionIncidentPolicyVersion,
    RecountRequest,
)
from lab.policies import MAX_OBSERVATION
from ovitraps.payloads import StrictBooleanField, StrictPayloadSerializer


class ObservationIntegerField(serializers.IntegerField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(min_value=0, max_value=MAX_OBSERVATION, **kwargs)

    def to_internal_value(self, value: Any) -> int:  # noqa: ANN401 -- DRF protocol
        if type(value) is not int:
            self.fail("invalid")
        return int(super().to_internal_value(value))


class LabQueueQuerySerializer(StrictPayloadSerializer):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    point = serializers.UUIDField(required=False)
    week = serializers.RegexField(r"^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$", required=False)
    code = serializers.CharField(max_length=50, required=False)
    ordering = serializers.ChoiceField(
        choices=["created_at", "-created_at", "code", "-code"], required=False
    )


class LabListQuerySerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    point = serializers.UUIDField(required=False)
    week = serializers.RegexField(r"^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$", required=False)
    code = serializers.CharField(max_length=50, required=False)
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at"], required=False)
    include_voided = serializers.BooleanField(required=False, default=False)
    author = serializers.UUIDField(required=False)
    method = serializers.UUIDField(required=False)
    created_from = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
    qa_state = serializers.ChoiceField(
        choices=["not_requested", "awaiting_independent_qa", "superseded"], required=False
    )
    kind = serializers.ChoiceField(choices=["missing", "no_reading"], required=False)
    configuration_pending = serializers.BooleanField(required=False)
    superseded = serializers.BooleanField(required=False)


class LabCommandSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()


class LabReceptionQuerySerializer(LabListQuerySerializer):
    kind = serializers.ChoiceField(choices=["bag", "no_paddle"], required=False)


class ReceiveBagSerializer(LabCommandSerializer, CodeQuerySerializer):
    pass


class MissingBagSerializer(LabCommandSerializer):
    reason = serializers.CharField(max_length=1000)


class CountValuesSerializer(StrictPayloadSerializer):
    value = ObservationIntegerField()
    confirmed_implausible = StrictBooleanField(required=False, default=False)
    viable_eggs = ObservationIntegerField(required=False)
    total_examined = ObservationIntegerField(required=False)
    method_version = serializers.UUIDField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        fields = {"viable_eggs", "total_examined", "method_version"}
        if fields.intersection(attrs) and not fields.issubset(attrs):
            raise serializers.ValidationError(
                {
                    key: [ErrorDetail("Required paired viability fact.", code="required")]
                    for key in fields.difference(attrs)
                }
            )
        if "viable_eggs" in attrs and attrs["viable_eggs"] > attrs["total_examined"]:
            raise serializers.ValidationError({"viable_eggs": ["invalid"]})
        return attrs


class CountWriteSerializer(LabCommandSerializer, CountValuesSerializer):
    expected_revision = serializers.IntegerField(min_value=0, required=False, default=0)
    queue_context = LabQueueQuerySerializer(required=False, default=dict)


class RejectionValuesSerializer(StrictPayloadSerializer):
    method_version = serializers.UUIDField()
    reason = serializers.CharField(max_length=1000)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=100
    )

    def validate_evidence_ids(self, identifiers: list[Any]) -> list[Any]:
        if len(set(identifiers)) != len(identifiers):
            raise serializers.ValidationError("duplicate")
        return identifiers


class RejectionWriteSerializer(LabCommandSerializer, RejectionValuesSerializer):
    expected_revision = serializers.IntegerField(min_value=0, required=False, default=0)
    queue_context = LabQueueQuerySerializer(required=False, default=dict)


class LabReplacementSerializer(StrictPayloadSerializer):
    """Closed variants reuse their real structural owners; there is no target override."""

    kind = serializers.ChoiceField(choices=["count", "rejection"])

    def to_internal_value(self, value: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF protocol
        if not isinstance(value, dict) or value.get("kind") not in ("count", "rejection"):
            raise serializers.ValidationError({"kind": ["invalid_choice"]})
        payload = {key: item for key, item in value.items() if key != "kind"}
        owner = CountValuesSerializer if value["kind"] == "count" else RejectionValuesSerializer
        parsed = owner(data=payload)
        parsed.is_valid(raise_exception=True)
        return {"kind": value["kind"], **parsed.validated_data}


class LabVoidSerializer(LabCommandSerializer):
    expected_revision = serializers.IntegerField(min_value=1)
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField(max_length=1000)
    replacement = LabReplacementSerializer(required=False)
    queue_context = LabQueueQuerySerializer(required=False, default=dict)


class CountReplacementSerializer(CountValuesSerializer):
    kind = serializers.ChoiceField(choices=["count"])


class RejectionReplacementSerializer(RejectionValuesSerializer):
    kind = serializers.ChoiceField(choices=["rejection"])


class LabReplacementSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]  # Spectacular's registration hook is untyped.
    target_class = LabReplacementSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- spectacular extension protocol
        count = auto_schema.resolve_serializer(CountReplacementSerializer(), direction).ref
        rejection = auto_schema.resolve_serializer(RejectionReplacementSerializer(), direction).ref
        return {
            "oneOf": [count, rejection],
            "discriminator": {
                "propertyName": "kind",
                "mapping": {"count": count["$ref"], "rejection": rejection["$ref"]},
            },
        }


class LabMethodWriteSerializer(StrictPayloadSerializer):
    code = serializers.CharField(max_length=50, required=False)
    expected_revision = serializers.IntegerField(min_value=0)
    name = serializers.CharField(max_length=200)
    procedure = serializers.CharField(max_length=20000)
    reference = serializers.CharField(max_length=1000)
    effective_from = serializers.DateTimeField()
    supports_viability = StrictBooleanField()
    supports_rejection = StrictBooleanField()


class LabMethodDecisionSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    reference = serializers.CharField(max_length=1000)


class ReceptionPolicyWriteSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    missing_type_version = serializers.UUIDField()
    no_reading_type_version = serializers.UUIDField()


class LabMethodSerializer(OrgScopedModelSerializer):
    class Meta:
        model = LabMethod
        fields = ("id", "code", "created_at", "created_by")
        read_only_fields = fields


class LabMethodVersionSerializer(OrgScopedModelSerializer):
    verification = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()

    @extend_schema_field(serializers.JSONField(allow_null=True))
    def get_verification(self, version: LabMethodVersion) -> dict[str, Any] | None:
        current = version.verifications.first()
        return None if current is None else dict(LabMethodVerificationSerializer(current).data)

    @extend_schema_field(serializers.CharField())
    def get_availability(self, version: LabMethodVersion) -> str:
        from core.time import server_now

        current = (
            version.method.versions.filter(effective_from__lte=server_now())
            .order_by("-effective_from", "-revision")
            .first()
        )
        if current is None or current.pk != version.pk:
            return "not_current"
        verification = version.verifications.first()
        if verification is None:
            return "unverified"
        return (
            "available"
            if verification.decision == "verify"
            and verification.content_hash == version.content_hash
            else "withdrawn"
        )

    class Meta:
        model = LabMethodVersion
        fields = (
            "id",
            "method",
            "revision",
            "name",
            "procedure",
            "reference",
            "effective_from",
            "content_hash",
            "supports_viability",
            "supports_rejection",
            "verification",
            "availability",
            "created_at",
            "created_by",
        )
        read_only_fields = fields


class LabMethodVerificationSerializer(OrgScopedModelSerializer):
    class Meta:
        model = LabMethodVerification
        fields = (
            "id",
            "method_version",
            "revision",
            "decision",
            "reference",
            "content_hash",
            "created_at",
            "created_by",
        )
        read_only_fields = fields


class ReceptionPolicySerializer(OrgScopedModelSerializer):
    class Meta:
        model = ReceptionIncidentPolicyVersion
        fields = (
            "id",
            "revision",
            "missing_type_version",
            "no_reading_type_version",
            "created_at",
            "created_by",
        )
        read_only_fields = fields


class ReceptionPolicyContextSerializer(serializers.Serializer[Any]):
    revision = serializers.IntegerField(min_value=0)
    policy = ReceptionPolicySerializer(allow_null=True)
    availability = serializers.ChoiceField(choices=["unconfigured", "configured", "unavailable"])


class LabReceptionConflictSerializer(serializers.Serializer[Any]):
    code = serializers.CharField()
    detail = serializers.CharField()
    blocked_by = serializers.ListField(child=serializers.DictField())
    discrepancy_id = serializers.UUIDField(required=False)
    incident_id = serializers.UUIDField(allow_null=True, required=False)


class LabQueueCandidateSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    reading_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    has_eggs = serializers.BooleanField()
    is_lagged = serializers.BooleanField()
    is_index_excluded = serializers.BooleanField()


class LabQueueSnapshotSerializer(serializers.Serializer[Any]):
    as_of = serializers.DateTimeField()

    def get_fields(self) -> dict[str, serializers.Field[Any, Any, Any, Any]]:
        fields = super().get_fields()
        fields["context"] = LabQueueQuerySerializer()
        return fields


class LabMethodPinSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    method_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    name = serializers.CharField()
    procedure = serializers.CharField()
    reference = serializers.CharField()
    effective_from = serializers.DateTimeField()
    content_hash = serializers.CharField()


class LabCountSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    bag_id = serializers.UUIDField()
    value = serializers.IntegerField(min_value=0, max_value=MAX_OBSERVATION)
    ordinal = serializers.IntegerField(min_value=1)
    viable_eggs = serializers.IntegerField(allow_null=True)
    total_examined = serializers.IntegerField(allow_null=True)
    viability_percent = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    viability_reason = serializers.ChoiceField(choices=["not_requested", "zero_examined", ""])
    method_version = serializers.UUIDField(allow_null=True)
    method = LabMethodPinSerializer(allow_null=True)
    verification_id = serializers.UUIDField(allow_null=True)
    rules = serializers.JSONField()
    source_proof = serializers.JSONField()
    created_at = serializers.DateTimeField()
    created_by = serializers.UUIDField()
    voided = serializers.BooleanField()
    expected_revision = serializers.IntegerField(min_value=1)
    current_revision = serializers.IntegerField(min_value=1, required=False)
    is_current = serializers.BooleanField(required=False)


class LabRejectionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    bag_id = serializers.UUIDField()
    method_version = serializers.UUIDField()
    method = LabMethodPinSerializer()
    verification_id = serializers.UUIDField()
    reason = serializers.CharField()
    evidence_ids = serializers.ListField(child=serializers.UUIDField())
    source_proof = serializers.JSONField()
    created_at = serializers.DateTimeField()
    created_by = serializers.UUIDField()
    voided = serializers.BooleanField()
    expected_revision = serializers.IntegerField(min_value=1)
    current_revision = serializers.IntegerField(min_value=1, required=False)
    is_current = serializers.BooleanField(required=False)


class LabCountOutcomeSerializer(serializers.Serializer[Any]):
    count = LabCountSerializer()
    next_bag = LabQueueCandidateSerializer(allow_null=True)
    queue_snapshot = LabQueueSnapshotSerializer()


class LabRejectionOutcomeSerializer(serializers.Serializer[Any]):
    rejection = LabRejectionSerializer()
    next_bag = LabQueueCandidateSerializer(allow_null=True)
    queue_snapshot = LabQueueSnapshotSerializer()


class LabVoidOutcomeSerializer(serializers.Serializer[Any]):
    void_id = serializers.UUIDField()
    current_revision = serializers.IntegerField(min_value=1)
    count = LabCountSerializer(allow_null=True)
    rejection = LabRejectionSerializer(allow_null=True)
    next_bag = LabQueueCandidateSerializer(allow_null=True)
    queue_snapshot = LabQueueSnapshotSerializer()


class LabReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    reading_id = serializers.UUIDField()
    bag_id = serializers.UUIDField(allow_null=True)
    kind = serializers.ChoiceField(choices=["bag", "no_paddle"])
    created_at = serializers.DateTimeField()
    created_by = serializers.UUIDField()


class LabBagSummarySerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(
        choices=[
            "expected",
            "missing",
            "no_effective_reading",
            "pending_count",
            "counted",
            "awaiting_independent_qa",
            "rejected",
            "voided",
        ]
    )
    revision = serializers.IntegerField(min_value=0)
    receipt_id = serializers.UUIDField(allow_null=True)
    count_id = serializers.UUIDField(allow_null=True)
    rejection_id = serializers.UUIDField(allow_null=True)


class ReceivedBagSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()


class ReceivedReadingSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    paddle_present = serializers.BooleanField()


class LabReceptionOutcomeSerializer(serializers.Serializer[Any]):
    bag = ReceivedBagSerializer(allow_null=True)
    reading = ReceivedReadingSerializer()
    receipt = LabReceiptSerializer()


class LabDiscrepancySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    bag_id = serializers.UUIDField()
    source_event_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["missing", "no_reading"])
    reason = serializers.CharField(allow_blank=True)
    source_proof = serializers.JSONField()
    created_at = serializers.DateTimeField()
    incident_id = serializers.UUIDField(allow_null=True)
    configuration_pending = serializers.BooleanField()
    incident_link = serializers.CharField(allow_null=True)


class LabVoidContextSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["count", "rejection"])
    bag_id = serializers.UUIDField()
    reading_id = serializers.UUIDField()
    source_event_id = serializers.UUIDField()
    current_revision = serializers.IntegerField(min_value=0)
    is_current = serializers.BooleanField()
    value = serializers.IntegerField(allow_null=True)
    reason = serializers.CharField(allow_null=True)
    method_version = serializers.UUIDField(allow_null=True)
    method_name = serializers.CharField(allow_null=True)
    evidence_ids = serializers.ListField(child=serializers.UUIDField())
    has_recount_obligation = serializers.BooleanField()
    blocked_by = serializers.ListField(child=serializers.DictField())


class RecountRequestSerializer(OrgScopedModelSerializer):
    causes = serializers.SerializerMethodField()
    superseded = serializers.SerializerMethodField()

    def get_causes(self, request: RecountRequest) -> list[dict[str, Any]]:
        return list(
            request.causes.order_by("created_at", "id").values(
                "id", "kind", "proof", "actor_kind", "created_at"
            )
        )

    def get_superseded(self, request: RecountRequest) -> bool:
        return hasattr(request, "supersession")

    class Meta:
        model = RecountRequest
        fields = (
            "id",
            "count",
            "first_counter",
            "independent_required",
            "actor_kind",
            "policy_version",
            "causes",
            "superseded",
            "created_at",
        )
        read_only_fields = fields
