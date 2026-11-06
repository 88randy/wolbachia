"""Strict additive field payloads; scope never comes from GPS or a home center."""

from rest_framework import serializers

from ovitraps.payloads import StrictPayloadSerializer


class IncidentScopeSerializer(StrictPayloadSerializer):
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(required=False)


class ResourceReferenceSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["motorcycle", "ovitrap_marker"])
    id = serializers.UUIDField()


class IncidentReportPayload(StrictPayloadSerializer):
    type_id = serializers.UUIDField(
        help_text="Pinned IncidentTypeVersion UUID, not CatalogItem UUID."
    )
    description = serializers.CharField(max_length=4000, trim_whitespace=True)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=100, default=list
    )
    resource_ref = ResourceReferenceSerializer(required=False)
    scope = IncidentScopeSerializer(required=False)


class AccidentGpsSerializer(StrictPayloadSerializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class EmergencyAccidentPayload(StrictPayloadSerializer):
    description = serializers.CharField(max_length=4000, trim_whitespace=True)
    gps = AccidentGpsSerializer(required=False)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=100, default=list
    )
    resource_ref = ResourceReferenceSerializer(required=False)
    scope = IncidentScopeSerializer(required=False)
