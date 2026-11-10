"""The permit payload is shared by bootstrap and its canonical change writer."""

from typing import Any

from rest_framework import serializers


class PermitBundleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    version = serializers.CharField()
    permit_version_id = serializers.UUIDField(allow_null=True)
    permit_type_id = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField(min_value=1)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField()
    geometry = serializers.JSONField(allow_null=True)
    valid_from = serializers.DateTimeField(allow_null=True)
    valid_to = serializers.DateTimeField(allow_null=True)
    requirements = serializers.JSONField()
    blocked_by = serializers.ListField(child=serializers.CharField())
