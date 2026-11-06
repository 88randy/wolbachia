"""Public schemas with no storage keys, invented roster or implicit organization selector."""

from typing import Any, Literal

from rest_framework import serializers

from core.filters import CODE_MAX_LENGTH
from core.serializers import OrgScopedModelSerializer
from incidents.configuration import validate_unique_blocker_kinds
from incidents.models import Incident, IncidentEvent, IncidentTypeVersion, Severity
from ovitraps.payloads import StrictPayloadSerializer


class IncidentBlockedBySerializer(serializers.Serializer[Any]):
    reason = serializers.CharField()
    unblocked_by_role = serializers.ChoiceField(choices=["admin", "supervisor"])
    link = serializers.CharField(allow_blank=True)
    current_revision = serializers.IntegerField(required=False, min_value=0)


class IncidentConflictResponseSerializer(serializers.Serializer[Any]):
    code = serializers.ChoiceField(choices=["incident_conflict"])
    detail = serializers.CharField()
    blocked_by = IncidentBlockedBySerializer(many=True)


class IncidentEventSerializer(OrgScopedModelSerializer):
    class Meta:
        model = IncidentEvent
        fields = [
            "id",
            "revision",
            "action",
            "state",
            "owner",
            "stage",
            "severity",
            "stage_entered_at",
            "deadline",
            "last_reminder_at",
            "text",
            "evidence_ids",
            "resolved_blocker_ids",
            "actor_kind",
            "created_by",
            "created_at",
            "policy_version",
        ]
        read_only_fields = fields


class ReportedIncidentSerializer(OrgScopedModelSerializer):
    revision = serializers.IntegerField(read_only=True)
    state = serializers.CharField(read_only=True)
    owner_id = serializers.UUIDField(read_only=True)
    severity = serializers.ChoiceField(choices=Severity.choices, read_only=True)
    deadline = serializers.DateTimeField(read_only=True, allow_null=True)
    timeline = IncidentEventSerializer(source="events", many=True, read_only=True)
    publication_state = serializers.SerializerMethodField()

    def get_publication_state(self, obj: Incident) -> Literal["outboxed", "pending_outbox"]:
        return "outboxed" if obj.notice_outboxed else "pending_outbox"  # type: ignore[attr-defined]

    class Meta:
        model = Incident
        fields = [
            "id",
            "code",
            "type_version",
            "center",
            "quadrant",
            "source_event",
            "device_time",
            "server_received_at",
            "description",
            "revision",
            "state",
            "owner_id",
            "severity",
            "deadline",
            "timeline",
            "publication_state",
            "created_at",
            "created_by",
        ]
        read_only_fields = fields


class IncidentTypeSerializer(OrgScopedModelSerializer):
    id = serializers.UUIDField(source="item_id", read_only=True)
    current_version_id = serializers.UUIDField(source="pk", read_only=True)

    class Meta:
        model = IncidentTypeVersion
        fields = [
            "id",
            "current_version_id",
            "revision",
            "code",
            "label",
            "icon",
            "is_other",
            "is_active",
            "severity",
            "supervisor",
            "coordinator",
            "terminal",
            "supervisor_sla_seconds",
            "coordinator_sla_seconds",
            "report_evidence_min",
            "close_evidence_min",
            "blocker_kinds",
        ]
        read_only_fields = fields


class TypeConfigurationSerializer(StrictPayloadSerializer):
    code = serializers.RegexField(r"^[a-z0-9][a-z0-9_-]*$", max_length=64, required=False)
    # Public payload key, distinct from the serializer's own Field.label.
    label = serializers.CharField(max_length=200, required=False)  # type: ignore[assignment]
    icon = serializers.RegexField(r"^[a-z0-9-]*$", max_length=64, required=False, allow_blank=True)
    expected_revision = serializers.IntegerField(min_value=0)
    severity = serializers.ChoiceField(choices=Severity.choices, required=False)
    supervisor_id = serializers.UUIDField(required=False, allow_null=True)
    coordinator_id = serializers.UUIDField(required=False, allow_null=True)
    terminal_id = serializers.UUIDField(required=False)
    supervisor_sla_seconds = serializers.IntegerField(
        min_value=1, max_value=2147483647, required=False
    )
    coordinator_sla_seconds = serializers.IntegerField(
        min_value=1, max_value=2147483647, required=False
    )
    report_evidence_min = serializers.IntegerField(min_value=0, max_value=100, required=False)
    close_evidence_min = serializers.IntegerField(min_value=1, max_value=100, required=False)
    blocker_kinds = serializers.ListField(
        child=serializers.ChoiceField(choices=["dispatch", "quadrant_closure"]),
        max_length=2,
        required=False,
        help_text="Kinds must be unique; duplicates return 400 validation_error.",
    )
    is_active = serializers.BooleanField(required=False)

    def validate_blocker_kinds(self, value: list[str]) -> list[str]:
        return validate_unique_blocker_kinds(value)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if self.context.get("create"):
            missing = {
                "code",
                "label",
                "severity",
                "terminal_id",
                "supervisor_sla_seconds",
                "coordinator_sla_seconds",
            } - attrs.keys()
            if missing:
                raise serializers.ValidationError(
                    {
                        name: [serializers.ErrorDetail("Required.", code="required")]
                        for name in sorted(missing)
                    }
                )
        elif "code" in attrs:
            raise serializers.ValidationError(
                {"code": [serializers.ErrorDetail("Code is immutable.", code="immutable")]}
            )
        return attrs


class CreateIncidentTypeSerializer(TypeConfigurationSerializer):
    expected_revision = serializers.IntegerField(min_value=0, required=False, default=0)

    def __init__(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF constructor forwards its public dynamic context/data options
        super().__init__(*args, **kwargs)
        for name in (
            "code",
            "label",
            "severity",
            "terminal_id",
            "supervisor_sla_seconds",
            "coordinator_sla_seconds",
        ):
            self.fields[name].required = True


class ExpectedRevisionSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=1)


class CommentSerializer(ExpectedRevisionSerializer):
    text = serializers.CharField(max_length=4000)


class ReassignSerializer(ExpectedRevisionSerializer):
    owner_id = serializers.UUIDField()


class SeveritySerializer(ExpectedRevisionSerializer):
    severity = serializers.ChoiceField(choices=Severity.choices)


class CloseSerializer(ExpectedRevisionSerializer):
    reason = serializers.CharField(max_length=1000)
    evidence_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100)


class IncidentVoidSerializer(ExpectedRevisionSerializer):
    reason = serializers.CharField(max_length=1000)


class IncidentFilterSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["fleet", "reported"], required=False, default="fleet")
    state = serializers.ChoiceField(choices=["open", "closed", "voided"], required=False)
    severity = serializers.ChoiceField(choices=Severity.choices, required=False)
    owner = serializers.UUIDField(required=False)
    type_id = serializers.UUIDField(required=False)
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    code = serializers.CharField(
        max_length=CODE_MAX_LENGTH,
        required=False,
        help_text="Exact code in reported mode only; fleet mode retains its legacy filters.",
    )
