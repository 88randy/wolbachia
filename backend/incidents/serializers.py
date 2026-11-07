"""Public schemas with no storage keys, invented roster or implicit organization selector."""

from collections.abc import Mapping
from typing import Any, Literal
from uuid import UUID

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.filters import CODE_MAX_LENGTH
from core.serializers import OrgScopedModelSerializer
from incidents.configuration import validate_unique_blocker_kinds
from incidents.models import Incident, IncidentEvent, IncidentTypeVersion, Severity
from incidents.origins import CREATION_ORIGINS
from ovitraps.payloads import StrictPayloadSerializer
from uploads.access import UploadActor, actor_from_request


def _actor(context: Mapping[str, Any]) -> UploadActor | None:
    request = context.get("request")
    return (
        actor_from_request(request)
        if request is not None and hasattr(request, "organization")
        else None
    )


class IncidentTypeSnapshotSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]  # public resource label
    icon = serializers.CharField()
    is_other = serializers.BooleanField()
    report_evidence_min = serializers.IntegerField(min_value=0)
    close_evidence_min = serializers.IntegerField(min_value=1)


class IncidentLinkedRecordSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(
        choices=["field_event", "review_item", "motorcycle", "ovitrap", "lot", "bag"],
        allow_null=True,
    )
    available = serializers.BooleanField()
    id = serializers.UUIDField(allow_null=True)
    code = serializers.CharField(allow_null=True)
    is_voided = serializers.BooleanField(allow_null=True)


class IncidentOwnedBlockerSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.CharField()
    is_active = serializers.BooleanField()
    resource = IncidentLinkedRecordSerializer()


class IncidentEvidenceSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    is_readable = serializers.BooleanField()
    is_verified = serializers.BooleanField(allow_null=True)
    verified_at = serializers.DateTimeField(allow_null=True)
    content_type = serializers.CharField(allow_null=True)
    size_bytes = serializers.IntegerField(allow_null=True)


class IncidentActionPermissionsSerializer(serializers.Serializer[Any]):
    comment = serializers.BooleanField()
    reassign = serializers.BooleanField()
    change_severity = serializers.BooleanField()
    close = serializers.BooleanField()
    void = serializers.BooleanField()


class IncidentActionPrerequisitesSerializer(serializers.Serializer[Any]):
    is_open = serializers.BooleanField()
    has_void_dependents = serializers.BooleanField()
    is_severity_protected = serializers.BooleanField()
    close_evidence_min = serializers.IntegerField(min_value=1)
    can_upload_evidence = serializers.BooleanField()


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
    author_display = serializers.SerializerMethodField()

    def get_author_display(self, obj: IncidentEvent) -> str | None:
        from incidents.workspace_projection import event_author_display

        return event_author_display(_actor(self.context), obj)

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
            "author_display",
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
    stage = serializers.IntegerField(read_only=True)
    owner_display = serializers.SerializerMethodField()
    type_snapshot = serializers.SerializerMethodField()
    origin = serializers.SerializerMethodField()
    linked_record = serializers.SerializerMethodField()
    blockers = serializers.SerializerMethodField()
    evidence = serializers.SerializerMethodField()
    action_permissions = serializers.SerializerMethodField()
    action_prerequisites = serializers.SerializerMethodField()

    def _projection(self, obj: Incident) -> dict[str, Any]:
        from incidents.workspace_projection import workspace_projection

        if not hasattr(self, "_workspace_cache"):
            self._workspace_cache: dict[UUID, dict[str, Any]] = {}
        cache = self._workspace_cache
        if obj.pk not in cache:
            cache[obj.pk] = workspace_projection(_actor(self.context), obj)
        return cache[obj.pk]

    def get_owner_display(self, obj: Incident) -> str | None:
        return self._projection(obj)["owner_display"]

    @extend_schema_field(IncidentTypeSnapshotSerializer(allow_null=True))
    def get_type_snapshot(self, obj: Incident) -> dict[str, Any] | None:
        snapshot = self._projection(obj)["type_snapshot"]
        return (
            None
            if snapshot is None
            else dict(IncidentTypeSnapshotSerializer(snapshot, context=self.context).data)
        )

    @extend_schema_field(serializers.ChoiceField(choices=CREATION_ORIGINS))
    def get_origin(self, obj: Incident) -> str:
        return (
            getattr(obj, "creation_origin", "unknown")
            if self._projection(obj)["type_snapshot"] is not None
            else "unknown"
        )

    @extend_schema_field(IncidentLinkedRecordSerializer())
    def get_linked_record(self, obj: Incident) -> dict[str, Any]:
        return dict(
            IncidentLinkedRecordSerializer(
                self._projection(obj)["linked_record"], context=self.context
            ).data
        )

    @extend_schema_field(IncidentOwnedBlockerSerializer(many=True))
    def get_blockers(self, obj: Incident) -> list[dict[str, Any]]:
        return list(
            IncidentOwnedBlockerSerializer(
                self._projection(obj)["blockers"], many=True, context=self.context
            ).data
        )

    @extend_schema_field(IncidentEvidenceSerializer(many=True))
    def get_evidence(self, obj: Incident) -> list[dict[str, Any]]:
        return list(
            IncidentEvidenceSerializer(
                self._projection(obj)["evidence"], many=True, context=self.context
            ).data
        )

    @extend_schema_field(IncidentActionPermissionsSerializer())
    def get_action_permissions(self, obj: Incident) -> dict[str, bool]:
        return dict(
            IncidentActionPermissionsSerializer(
                self._projection(obj)["action_permissions"], context=self.context
            ).data
        )

    @extend_schema_field(IncidentActionPrerequisitesSerializer(allow_null=True))
    def get_action_prerequisites(self, obj: Incident) -> dict[str, Any] | None:
        prerequisites = self._projection(obj)["action_prerequisites"]
        return (
            None
            if prerequisites is None
            else dict(
                IncidentActionPrerequisitesSerializer(prerequisites, context=self.context).data
            )
        )

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
            "stage",
            "owner_display",
            "type_snapshot",
            "origin",
            "linked_record",
            "blockers",
            "evidence",
            "action_permissions",
            "action_prerequisites",
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
    assigned_to_me = serializers.ChoiceField(choices=["true", "false"], required=False)
    overdue = serializers.ChoiceField(choices=["true", "false"], required=False)
    escalated = serializers.ChoiceField(choices=["true", "false"], required=False)
    type = serializers.UUIDField(required=False)
    origin = serializers.ChoiceField(choices=CREATION_ORIGINS, required=False)
    code = serializers.CharField(
        max_length=CODE_MAX_LENGTH,
        required=False,
        help_text="Exact code in reported mode only; fleet mode retains its legacy filters.",
    )


class IncidentTypeQuerySerializer(StrictPayloadSerializer):
    reportable = serializers.ChoiceField(choices=["true", "false"], required=False)


class IncidentOptionQuerySerializer(StrictPayloadSerializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=200)
    page = serializers.IntegerField(required=False, min_value=1)
    page_size = serializers.IntegerField(required=False, min_value=1)


class IncidentContextQuerySerializer(IncidentOptionQuerySerializer):
    action = serializers.ChoiceField(choices=["read", "create"])
    center = serializers.UUIDField(required=False)


class IncidentContextOptionSerializer(serializers.Serializer[Any]):
    center_id = serializers.UUIDField()
    center_code = serializers.CharField()
    center_name = serializers.CharField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    quadrant_code = serializers.CharField(allow_null=True)


class IncidentOwnerOptionSerializer(serializers.Serializer[Any]):
    membership_id = serializers.UUIDField(source="pk")
    label = serializers.CharField()  # type: ignore[assignment]  # minimal owner display label
