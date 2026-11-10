"""Closed command inputs; serializers never resolve mutable eligibility or science."""

from datetime import datetime
from typing import Any

from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_naive
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from lab.policies import MAX_OBSERVATION
from lab.serializers import CountValuesSerializer, LabCommandSerializer, ObservationIntegerField
from ovitraps.payloads import StrictPayloadSerializer

QA_STATES = [
    "awaiting_second",
    "awaiting_third",
    "awaiting_selection",
    "resolved",
    "superseded",
    "awaiting_configuration",
    "awaiting_material",
]


@extend_schema_field(
    {"type": "string", "enum": QA_STATES}, component_name="LabIndependentQAStateEnum"
)
class QAStateField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=QA_STATES, **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["second", "third"]}, component_name="LabIndependentRoleEnum"
)
class RecountRoleField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["second", "third"], **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["resolved"]}, component_name="LabResolvedQAStateEnum"
)
class ResolvedQAStateField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["resolved"], **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["configured", "unavailable"]},
    component_name="LabQAPolicyAvailabilityEnum",
)
class QAPolicyAvailabilityField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["configured", "unavailable"], **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["configured", "unconfigured", "unverified"]},
    component_name="LabQAMethodAvailabilityEnum",
)
class QAMethodAvailabilityField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["configured", "unconfigured", "unverified"], **kwargs)


class RecountQuerySerializer(StrictPayloadSerializer):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    code = serializers.CharField(max_length=50, required=False)
    state = QAStateField(required=False)
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at"], required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=200, required=False)


class RecountClaimSerializer(LabCommandSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    role = RecountRoleField()


class IndependentCountSerializer(CountValuesSerializer, LabCommandSerializer):
    request_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    expected_result_revision = serializers.IntegerField(min_value=1)
    method_version = serializers.UUIDField()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # A method is always required for QA, even when viability is not measured.
        measured = {"viable_eggs", "total_examined"}
        if measured.intersection(attrs) and not measured.issubset(attrs):
            raise serializers.ValidationError(
                {key: ["required"] for key in measured.difference(attrs)}
            )
        if measured.issubset(attrs) and attrs["viable_eggs"] > attrs["total_examined"]:
            raise serializers.ValidationError({"viable_eggs": ["invalid"]})
        return attrs


class RecountDecisionSerializer(LabCommandSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    expected_result_revision = serializers.IntegerField(min_value=1)
    final_attempt_id = serializers.UUIDField()
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField(max_length=1000)


class IndependenceAttestationSerializer(RecountClaimSerializer):
    expected_result_revision = serializers.IntegerField(min_value=1)
    counter_id = serializers.UUIDField()
    external_reference = serializers.UUIDField()
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField(max_length=1000)


class LabQAPolicyWriteSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    absolute_tolerance = serializers.IntegerField(
        min_value=0, max_value=MAX_OBSERVATION, default=10
    )
    relative_per_100 = serializers.IntegerField(min_value=0, max_value=100, default=10)
    qa_method_version = serializers.UUIDField(allow_null=True)
    reuse_method_version = serializers.UUIDField(allow_null=True)


class LabQAPolicySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    absolute_tolerance = ObservationIntegerField()
    relative_per_100 = serializers.IntegerField(min_value=0, max_value=100)
    qa_method_version = serializers.UUIDField(allow_null=True)
    reuse_method_version = serializers.UUIDField(allow_null=True)
    content_hash = serializers.CharField()


@extend_schema_serializer(many=False)
class LabQAPolicyContextSerializer(serializers.Serializer[Any]):
    revision = serializers.IntegerField(min_value=0)
    policy = LabQAPolicySerializer(allow_null=True)
    availability = QAPolicyAvailabilityField()
    qa_availability = QAMethodAvailabilityField()
    reuse_availability = QAMethodAvailabilityField()


class RecountQueueSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    bag_id = serializers.UUIDField()
    bag_code = serializers.CharField()
    reading_id = serializers.UUIDField()
    state = QAStateField()
    expected_revision = serializers.IntegerField(min_value=0)
    expected_result_revision = serializers.IntegerField(min_value=0)


class RecountClaimReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    request_id = serializers.UUIDField()
    role = RecountRoleField()
    revision = serializers.IntegerField(min_value=1)


class RecountClaimOutcomeSerializer(serializers.Serializer[Any]):
    claim = RecountClaimReceiptSerializer()


class IndependenceAttestationReceiptSerializer(RecountClaimReceiptSerializer):
    counter_id = serializers.UUIDField()


class IndependenceAttestationOutcomeSerializer(serializers.Serializer[Any]):
    attestation = IndependenceAttestationReceiptSerializer()


class RecountAttemptReceiptSerializer(RecountClaimReceiptSerializer):
    value = ObservationIntegerField()
    method_version = serializers.UUIDField()


class RecountQueueContextSerializer(serializers.Serializer[Any]):
    permission = serializers.CharField()
    ordering = serializers.CharField()
    purpose = serializers.CharField()


class IndependentCountOutcomeSerializer(serializers.Serializer[Any]):
    attempt = RecountAttemptReceiptSerializer()
    qa_state = QAStateField()
    next_recount = RecountQueueSerializer(allow_null=True)
    queue_context = RecountQueueContextSerializer()


class RecountResolutionReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    request_id = serializers.UUIDField()
    final_attempt_id = serializers.UUIDField()
    candidate_kind = serializers.ChoiceField(choices=["first", "second", "third"])
    revision = serializers.IntegerField(min_value=1)


class RecountDecisionOutcomeSerializer(serializers.Serializer[Any]):
    resolution = RecountResolutionReceiptSerializer()
    qa_state = ResolvedQAStateField()


class PaddleEvidenceSerializer(LabCommandSerializer):
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100
    )

    def validate_evidence_ids(self, values: list[Any]) -> list[Any]:
        if len(values) != len(set(values)):
            raise serializers.ValidationError("duplicate")
        return sorted(values, key=str)


class PaddleRegistrationSerializer(PaddleEvidenceSerializer):
    code = serializers.CharField(max_length=50)
    piece_id = serializers.UUIDField()
    source_movement_id = serializers.UUIDField()
    location_id = serializers.UUIDField()


class PaddleBindingSerializer(PaddleEvidenceSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    bag_id = serializers.UUIDField()
    issue_movement_id = serializers.UUIDField()


class PaddleTreatmentInstantField(serializers.DateTimeField):
    def to_internal_value(self, value: Any) -> datetime:  # noqa: ANN401 -- DRF raw input boundary.
        try:
            parsed = parse_datetime(value) if isinstance(value, str) else value
        except ValueError:
            parsed = None
        if isinstance(parsed, datetime) and is_naive(parsed):
            raise serializers.ValidationError("Timezone offset is required.", code="invalid")
        return super().to_internal_value(value)


class PaddleReuseSerializer(PaddleEvidenceSerializer):
    expected_revision = serializers.IntegerField(min_value=1)
    binding_id = serializers.UUIDField()
    expected_result_revision = serializers.IntegerField(min_value=1)
    expected_qa_revision = serializers.IntegerField(min_value=0)
    destination_location_id = serializers.UUIDField()
    source_movement_id = serializers.UUIDField()
    washed_at = PaddleTreatmentInstantField()
    dried_at = PaddleTreatmentInstantField()
    method_version = serializers.UUIDField()


class PaddleQuerySerializer(StrictPayloadSerializer):
    code = serializers.CharField(max_length=50, required=False)
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at"], required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=200, required=False)


class PaddleReuseQuerySerializer(StrictPayloadSerializer):
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at"], required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=200, required=False)


class PaddleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    piece_id = serializers.UUIDField()
    source_movement_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=0)
    created_at = serializers.DateTimeField()


class PaddleRegistrationOutcomeSerializer(serializers.Serializer[Any]):
    paddle = PaddleSerializer()


class PaddleBindingReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    paddle_id = serializers.UUIDField()
    bag_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)


class PaddleBindingOutcomeSerializer(serializers.Serializer[Any]):
    binding = PaddleBindingReceiptSerializer()


class PaddleReuseReceiptSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    paddle_id = serializers.UUIDField()
    binding_id = serializers.UUIDField()
    reuse_number = serializers.IntegerField(min_value=1, max_value=2)
    revision = serializers.IntegerField(min_value=1)
    stock_return_id = serializers.UUIDField()
    stock_operation_id = serializers.UUIDField()
    stock_movement_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    recovery_kind = serializers.ChoiceField(choices=["consumed", "custody"])


class PaddleReuseOutcomeSerializer(serializers.Serializer[Any]):
    reuse = PaddleReuseReceiptSerializer()
