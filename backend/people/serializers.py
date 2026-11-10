"""Closed writes and declared read DTOs keep operational summaries and private proof apart."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.author_names import AuthorNameField
from core.serializers import OrgScopedModelSerializer
from core.void_reason import VoidSerializer
from ovitraps.payloads import StrictBooleanField, StrictPayloadSerializer
from people.models import (
    ActionTrainingRequirementVersion,
    Certification,
    CertificationRevocation,
    Evaluation,
    EvaluationAttempt,
    EvaluationNoticePolicyVersion,
    EvaluationRubric,
    EvaluationRubricVersion,
    EvaluationVoid,
    Training,
    TrainingVersion,
)
from people.notices import NOTICE_BATCH_LIMIT
from people.policy import DEFAULT_PASS_THRESHOLD, DEFAULT_WEIGHTS, RubricPolicy


class PeopleIntegerField(serializers.IntegerField):
    def to_internal_value(self, value: Any) -> int:  # noqa: ANN401 -- DRF field protocol
        if type(value) is not int:
            self.fail("invalid")
        return int(super().to_internal_value(value))


class AwareInstantField(serializers.DateTimeField):
    def to_internal_value(self, value: Any) -> datetime:  # noqa: ANN401 -- DRF field protocol
        instant = super().to_internal_value(value)
        parsed = parse_datetime(value) if isinstance(value, str) else value
        if isinstance(parsed, datetime) and parsed.tzinfo is None:
            raise serializers.ValidationError("Use an aware instant.", code="naive_datetime")
        return instant


class PeopleWriteSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    expected_revision = PeopleIntegerField(min_value=0)


class IdentityWriteSerializer(PeopleWriteSerializer):
    code = serializers.RegexField(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
    name = serializers.CharField(max_length=200)


class TrainingVersionWriteSerializer(PeopleWriteSerializer):
    validity_seconds = PeopleIntegerField(min_value=1, max_value=315537897599)
    enabled_actions = serializers.ListField(
        child=serializers.RegexField(r"^[a-z][a-z0-9_.-]{0,99}$"), min_length=1, max_length=100
    )
    effective_from = AwareInstantField()
    is_active = StrictBooleanField()

    def validate_enabled_actions(self, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Use unique actions.", code="duplicate_action")
        return sorted(value)


class PeopleContextSerializer(StrictPayloadSerializer):
    center = serializers.UUIDField(source="center_id")
    quadrant = serializers.UUIDField(
        source="quadrant_id", allow_null=True, default=None, required=False
    )


class RequirementWriteSerializer(PeopleWriteSerializer, PeopleContextSerializer):
    effective_from = AwareInstantField()
    acceptable_versions = serializers.DictField(
        child=serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100),
        allow_empty=False,
    )

    def validate_acceptable_versions(self, value: dict[str, list[UUID]]) -> dict[str, list[UUID]]:
        try:
            normalized = {str(UUID(key)): sorted(identifiers) for key, identifiers in value.items()}
        except (ValueError, TypeError, AttributeError) as error:
            raise serializers.ValidationError(
                "Use training UUID keys.", code="invalid_training"
            ) from error
        if len(normalized) != len(value) or any(
            len(set(ids)) != len(ids) for ids in normalized.values()
        ):
            raise serializers.ValidationError("Use unique version pins.", code="duplicate_version")
        return normalized


class CertificationWriteSerializer(PeopleWriteSerializer, PeopleContextSerializer):
    training_version = serializers.UUIDField(source="training_version_id")
    valid_from = AwareInstantField()
    valid_to = AwareInstantField()
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=100
    )
    issuer_reference = serializers.CharField(max_length=300)
    attestation = serializers.CharField(max_length=1000)


class CertificationRevokeSerializer(PeopleWriteSerializer, VoidSerializer):
    effective_from = AwareInstantField()


class PeopleContextFilterSerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)


class EvaluationListFilterSerializer(PeopleContextFilterSerializer):
    subject = serializers.UUIDField(required=False)
    include_voided = serializers.ChoiceField(choices=["true", "false"], default="false")


class CertificationListFilterSerializer(PeopleContextFilterSerializer):
    training_version = serializers.UUIDField(required=False)
    proof = serializers.ChoiceField(choices=["true", "false"], default="false")


class RubricVersionWriteSerializer(PeopleWriteSerializer):
    weights = serializers.DictField(
        child=PeopleIntegerField(min_value=0, max_value=100), default=lambda: dict(DEFAULT_WEIGHTS)
    )
    pass_threshold = serializers.DecimalField(
        max_digits=7, decimal_places=4, min_value=0, max_value=100, default=DEFAULT_PASS_THRESHOLD
    )
    critical_checks = serializers.ListField(
        child=serializers.RegexField(r"^[a-z][a-z0-9_.-]{0,63}$"), min_length=1, max_length=100
    )
    effective_from = AwareInstantField()

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        try:
            RubricPolicy(attrs["weights"], attrs["pass_threshold"], tuple(attrs["critical_checks"]))
        except ValueError as error:
            raise serializers.ValidationError(
                {"weights": "Use complete coherent rubric configuration."}, code="invalid_rubric"
            ) from error
        return attrs


class EvaluationValuesSerializer(StrictPayloadSerializer):
    section_scores = serializers.DictField(
        child=serializers.DecimalField(
            max_digits=9, decimal_places=6, min_value=0, max_value=100, allow_null=True
        )
    )
    critical_responses = serializers.DictField(child=StrictBooleanField(allow_null=True))
    observed_at = AwareInstantField()

    def validate_section_scores(
        self, value: dict[str, Decimal | None]
    ) -> dict[str, Decimal | None]:
        if set(value) != set(DEFAULT_WEIGHTS):
            raise serializers.ValidationError(
                "Supply every section, with null for an unobserved section.",
                code="incomplete_observation",
            )
        return value


class EvaluationCreateSerializer(
    PeopleWriteSerializer, PeopleContextSerializer, EvaluationValuesSerializer
):
    subject = serializers.UUIDField(source="subject_id")
    rubric_version = serializers.UUIDField(source="rubric_version_id")


class EvaluationVoidSerializer(PeopleWriteSerializer, VoidSerializer):
    expected_completion_sequence = PeopleIntegerField(min_value=0)


class EvaluationRevisionSerializer(EvaluationVoidSerializer, EvaluationValuesSerializer):
    pass


class NoticePolicyWriteSerializer(PeopleWriteSerializer, PeopleContextSerializer):
    recipient_membership_id = serializers.UUIDField()
    reroute_cause_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=NOTICE_BATCH_LIMIT, required=False, default=list
    )

    def validate_reroute_cause_ids(self, value: list[UUID]) -> list[UUID]:
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Use unique cause UUIDs.", code="duplicate_cause")
        return sorted(value)


class EvaluationResultSerializer(serializers.Serializer[Any]):
    attempt_id = serializers.UUIDField()
    rubric_version_id = serializers.UUIDField()
    outcome = serializers.ChoiceField(choices=["incomplete", "pass", "low", "critical_failure"])
    score = serializers.DecimalField(max_digits=11, decimal_places=8, allow_null=True)
    completion_sequence = serializers.IntegerField(allow_null=True)


class PeopleReceiptSerializer(serializers.Serializer[Any]):
    command_id = serializers.UUIDField()
    id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=0)
    recorded_at = serializers.DateTimeField()
    evaluation = EvaluationResultSerializer(allow_null=True)
    rerouted_cause_ids = serializers.ListField(child=serializers.UUIDField(), required=False)


class TrainingReadSerializer(OrgScopedModelSerializer):
    revision = serializers.IntegerField(source="_read_revision", read_only=True)
    current_version_id = serializers.UUIDField(
        source="_current_version_id", read_only=True, allow_null=True
    )

    class Meta:
        model = Training
        fields = ["id", "code", "name", "revision", "current_version_id"]


class TrainingVersionReadSerializer(OrgScopedModelSerializer):
    training_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = TrainingVersion
        fields = [
            "id",
            "training_id",
            "version",
            "validity_seconds",
            "enabled_actions",
            "effective_from",
            "is_active",
            "created_at",
        ]


class RequirementReadSerializer(OrgScopedModelSerializer):
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = ActionTrainingRequirementVersion
        fields = [
            "id",
            "action",
            "center_id",
            "quadrant_id",
            "revision",
            "effective_from",
            "acceptable_versions",
            "created_at",
        ]


class CertificationSummarySerializer(OrgScopedModelSerializer):
    subject_id = serializers.UUIDField(read_only=True)
    training_version_id = serializers.UUIDField(read_only=True)
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    revision = serializers.IntegerField(source="_read_revision", read_only=True)
    revoked_from = serializers.DateTimeField(
        source="_revoked_from", read_only=True, allow_null=True
    )

    class Meta:
        model = Certification
        fields = [
            "id",
            "subject_id",
            "training_version_id",
            "center_id",
            "quadrant_id",
            "valid_from",
            "valid_to",
            "created_at",
            "revision",
            "revoked_from",
        ]


class CertificationProofSerializer(CertificationSummarySerializer):
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)

    class Meta(CertificationSummarySerializer.Meta):
        fields = [
            *CertificationSummarySerializer.Meta.fields,
            "created_by",
            "evidence_ids",
            "issuer_reference",
            "attestation",
        ]


class CertificationRevocationReadSerializer(OrgScopedModelSerializer):
    certification_id = serializers.UUIDField(read_only=True)
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)

    class Meta:
        model = CertificationRevocation
        fields = [
            "id",
            "certification_id",
            "revision",
            "effective_from",
            "reason_code",
            "reason",
            "created_at",
            "created_by",
        ]


class RubricReadSerializer(OrgScopedModelSerializer):
    revision = serializers.IntegerField(source="_read_revision", read_only=True)
    current_version_id = serializers.UUIDField(
        source="_current_version_id", read_only=True, allow_null=True
    )

    class Meta:
        model = EvaluationRubric
        fields = ["id", "code", "name", "revision", "current_version_id"]


class RubricVersionReadSerializer(OrgScopedModelSerializer):
    rubric_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = EvaluationRubricVersion
        fields = [
            "id",
            "rubric_id",
            "version",
            "weights",
            "pass_threshold",
            "critical_checks",
            "effective_from",
            "created_at",
        ]


class EvaluationAttemptReadSerializer(OrgScopedModelSerializer):
    evaluation_id = serializers.UUIDField(read_only=True)
    predecessor_id = serializers.UUIDField(read_only=True, allow_null=True)
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)
    completion_sequence = serializers.IntegerField(
        source="completion.sequence", allow_null=True, read_only=True, default=None
    )

    class Meta:
        model = EvaluationAttempt
        fields = [
            "id",
            "evaluation_id",
            "predecessor_id",
            "revision",
            "observed_at",
            "section_scores",
            "critical_responses",
            "score",
            "outcome",
            "reason_code",
            "reason",
            "created_at",
            "created_by",
            "completion_sequence",
        ]


class EvaluationVoidReadSerializer(OrgScopedModelSerializer):
    evaluation_id = serializers.UUIDField(read_only=True)
    attempt_id = serializers.UUIDField(read_only=True)
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)

    class Meta:
        model = EvaluationVoid
        fields = [
            "id",
            "evaluation_id",
            "attempt_id",
            "revision",
            "reason_code",
            "reason",
            "created_at",
            "created_by",
        ]


class EvaluationReadSerializer(OrgScopedModelSerializer):
    subject_id = serializers.UUIDField(read_only=True)
    rubric_version_id = serializers.UUIDField(read_only=True)
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    revision = serializers.IntegerField(source="_read_revision", read_only=True)
    is_voided = serializers.BooleanField(source="_is_voided", read_only=True)
    current = serializers.SerializerMethodField()
    void = EvaluationVoidReadSerializer(
        source="void_record", allow_null=True, read_only=True, default=None
    )

    @extend_schema_field(EvaluationAttemptReadSerializer(allow_null=True))
    def get_current(self, obj: Evaluation) -> dict[str, Any] | None:
        attempt = self.context.get("attempts", {}).get(obj.pk)
        return None if attempt is None else dict(EvaluationAttemptReadSerializer(attempt).data)

    class Meta:
        model = Evaluation
        fields = [
            "id",
            "subject_id",
            "rubric_version_id",
            "center_id",
            "quadrant_id",
            "created_at",
            "revision",
            "is_voided",
            "current",
            "void",
        ]


class NoticePolicyReadSerializer(OrgScopedModelSerializer):
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True, allow_null=True)
    recipient_membership_id = serializers.UUIDField(read_only=True)
    recipient_name = AuthorNameField("recipient_membership.user")

    class Meta:
        model = EvaluationNoticePolicyVersion
        fields = [
            "id",
            "center_id",
            "quadrant_id",
            "recipient_membership_id",
            "recipient_name",
            "revision",
            "created_at",
        ]


class EligibilityQuerySerializer(PeopleContextSerializer):
    action = serializers.RegexField(r"^[a-z][a-z0-9_.-]{0,99}$")
    at = AwareInstantField(required=False)


class TrainingAssessmentSerializer(serializers.Serializer[Any]):
    subject_id = serializers.UUIDField()
    action = serializers.CharField()
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    training_eligible = serializers.BooleanField()
    requirement_version_id = serializers.UUIDField(allow_null=True)
    certification_ids = serializers.ListField(child=serializers.UUIDField())
    training_version_ids = serializers.ListField(child=serializers.UUIDField())
    revocation_ids = serializers.ListField(child=serializers.UUIDField())
    valid_from = serializers.DateTimeField(allow_null=True)
    valid_until = serializers.DateTimeField(allow_null=True)
    next_change_at = serializers.DateTimeField(allow_null=True)
    blockers = serializers.ListField(child=serializers.CharField())


class EligibilityReadSerializer(TrainingAssessmentSerializer):
    query_kind = serializers.ChoiceField(choices=["current", "retrospective", "future"])


class EligibilityBundleSerializer(TrainingAssessmentSerializer):
    organization_id = serializers.UUIDField()
    id = serializers.UUIDField()
    assessment_receipt = serializers.UUIDField(allow_null=True)
    version = serializers.CharField()


class EligibilityChangeSerializer(serializers.Serializer[Any]):
    sequence = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=["upsert", "remove"])
    resource_type = serializers.ChoiceField(choices=["training_eligibility"])
    resource_id = serializers.UUIDField()
    resource_version = serializers.CharField()
    data = EligibilityBundleSerializer()  # type: ignore[assignment]  # Declared wire field, not Serializer.data.
