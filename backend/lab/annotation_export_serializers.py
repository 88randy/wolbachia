"""Closed training-dataset request and public job projection."""

from datetime import date
from typing import Any

from rest_framework import serializers

from core.exceptions import FieldValidationError
from ovitraps.payloads import StrictPayloadSerializer

MAX_EXPORT_DAYS = 366


class EggAnnotationExportCreateSerializer(StrictPayloadSerializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    author = serializers.UUIDField(required=False, allow_null=True)
    include_voided = serializers.BooleanField(default=False)
    format = serializers.ChoiceField(choices=["coco", "yolo"])

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        days = (attrs["date_to"] - attrs["date_from"]).days + 1
        if not 1 <= days <= MAX_EXPORT_DAYS or attrs["date_to"] == date.max:
            raise FieldValidationError(
                "date_to", "annotation_export_date_range", {"max_days": MAX_EXPORT_DAYS}
            )
        return attrs


class EggAnnotationExportSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    author = serializers.UUIDField(allow_null=True)
    include_voided = serializers.BooleanField()
    format = serializers.ChoiceField(choices=["coco", "yolo"])
    status = serializers.ChoiceField(choices=["queued", "running", "ready", "failed"])
    image_count = serializers.IntegerField(min_value=0)
    box_count = serializers.IntegerField(min_value=0)
    point_count = serializers.IntegerField(min_value=0)
    error_code = serializers.CharField(allow_blank=True)
    size_bytes = serializers.IntegerField(allow_null=True)
    sha256 = serializers.CharField(allow_blank=True)
