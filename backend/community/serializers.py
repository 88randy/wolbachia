"""Read DTOs preserve archived context and redact Incident authority independently."""

from typing import Any

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from community.models import CommunityActivity
from community.payloads import CommunityActivityPayload
from core.author_names import AuthorNamesMixin
from core.serializers import OrgScopedModelSerializer
from core.void_reason import VoidSerializer
from organizations.scope import EffectiveScope
from ovitraps.payloads import StrictPayloadSerializer
from uploads.access import actor_from_request, current_scope


class CreateCommunityActivitySerializer(CommunityActivityPayload):
    command_id = serializers.UUIDField()


class VoidCommunityActivitySerializer(StrictPayloadSerializer, VoidSerializer):
    command_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=1, max_value=1)


class CommunityReceiptSerializer(serializers.Serializer[Any]):
    activity_id = serializers.UUIDField()
    event_id = serializers.UUIDField()
    command_id = serializers.UUIDField()
    code = serializers.CharField()
    revision = serializers.IntegerField(min_value=1, max_value=2)
    server_received_at = serializers.DateTimeField()


class CommunityTypeSnapshotSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField(required=False)
    code = serializers.CharField()
    label_es = serializers.CharField()
    label_en = serializers.CharField(allow_blank=True)
    is_other = serializers.BooleanField()
    requires_photo = serializers.BooleanField()


class CommunityIncidentReferenceSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    state = serializers.ChoiceField(choices=["open", "closed", "voided"])


class CommunityEventSerializer(AuthorNamesMixin, serializers.Serializer[Any]):
    id = serializers.UUIDField()
    revision = serializers.IntegerField()
    action = serializers.ChoiceField(choices=["create", "void"])
    command_id = serializers.UUIDField()
    origin = serializers.ChoiceField(choices=["http", "field"])
    device_time = serializers.DateTimeField(allow_null=True)
    server_received_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    created_by = serializers.UUIDField(source="created_by_id")
    reason = serializers.CharField(allow_blank=True)
    reason_code = serializers.CharField(allow_blank=True)


class CommunityActivitySerializer(OrgScopedModelSerializer):
    _community_scope: EffectiveScope | None = None
    revision = serializers.IntegerField(read_only=True)
    is_voided = serializers.BooleanField(read_only=True)
    zone_id = serializers.UUIDField(read_only=True)
    zone_code = serializers.CharField(source="zone.code", read_only=True)
    zone_version_id = serializers.UUIDField(read_only=True)
    center_id = serializers.UUIDField(read_only=True)
    quadrant_id = serializers.UUIDField(read_only=True)
    type_id = serializers.UUIDField(read_only=True)
    type_snapshot = CommunityTypeSnapshotSerializer(read_only=True)
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)
    events = CommunityEventSerializer(many=True, read_only=True)
    incident = serializers.SerializerMethodField()

    class Meta:
        model = CommunityActivity
        fields = [
            "id",
            "code",
            "revision",
            "is_voided",
            "type_id",
            "type_snapshot",
            "zone_id",
            "zone_code",
            "zone_version_id",
            "center_id",
            "quadrant_id",
            "activity_date",
            "captured_timezone",
            "attendance",
            "agreements",
            "other_text",
            "created_at",
            "created_by",
            "events",
            "incident",
        ]
        read_only_fields = fields

    @extend_schema_field(CommunityIncidentReferenceSerializer(allow_null=True))
    def get_incident(self, activity: CommunityActivity) -> dict[str, Any] | None:
        link = getattr(activity, "complaint_link", None)
        if link is None:
            return None
        incident = link.incident
        request = self.context["request"]
        if self._community_scope is None:
            self._community_scope = current_scope(actor_from_request(request))
        scope = self._community_scope
        if incident.organization_id != activity.organization_id or not scope.allows(
            "incident.read", str(incident.center_id), str(incident.quadrant_id)
        ):
            return None
        from incidents.selectors import current_event

        return dict(
            CommunityIncidentReferenceSerializer(
                {"id": incident.pk, "code": incident.code, "state": current_event(incident).state}
            ).data
        )


class CommunityFilterSerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=30, required=False)
    zone_id = serializers.UUIDField(required=False)
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    type_id = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_before = serializers.DateField(required=False)
    include_voided = serializers.BooleanField(required=False, default=False)


class CommunityTotalsSerializer(serializers.Serializer[Any]):
    active_activity_count = serializers.IntegerField(min_value=0)
    attendance = serializers.RegexField(r"^\d+$")


@extend_schema_serializer(many=False)
class CommunityActivityPageSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = CommunityActivitySerializer(many=True)
    totals = CommunityTotalsSerializer()


class CommunityZoneOptionsFilterSerializer(serializers.Serializer[Any]):
    action = serializers.ChoiceField(choices=["read", "create"])
    center = serializers.UUIDField(required=False)
    quadrant = serializers.UUIDField(required=False)
    search = serializers.CharField(required=False, max_length=100, allow_blank=True)


class CommunityZoneOptionSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    quadrant_id = serializers.UUIDField()
    quadrant_code = serializers.CharField(source="quadrant.code")
    center_id = serializers.UUIDField(source="quadrant.center_id")
    center_code = serializers.CharField(source="quadrant.center.code")


@extend_schema_serializer(many=False)
class CommunityZoneOptionsPageSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = CommunityZoneOptionSerializer(many=True)
