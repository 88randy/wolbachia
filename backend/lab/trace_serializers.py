"""Response contract of `GET /api/v1/bags/{code}/trace/` (read-only; source of the client types)."""

from typing import Any

from rest_framework import serializers

Base = serializers.Serializer[Any]


class TraceActorSerializer(Base):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)


class TraceVoidSerializer(Base):
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)
    reason_code = serializers.CharField()
    reason = serializers.CharField(allow_blank=True)


class TraceCaptureSerializer(Base):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    accuracy_m = serializers.FloatField(allow_null=True)
    distance_to_point_m = serializers.FloatField()


class TracePhotoSerializer(Base):
    id = serializers.UUIDField()
    content_type = serializers.CharField()


class TracePaddleTypeSerializer(Base):
    code = serializers.CharField()
    label_es = serializers.CharField()
    label_en = serializers.CharField(allow_blank=True)


class TraceReadingSerializer(Base):
    id = serializers.UUIDField()
    device_time = serializers.DateTimeField()
    server_received_at = serializers.DateTimeField()
    courier = TraceActorSerializer(allow_null=True)
    paddle_present = serializers.BooleanField()
    has_eggs = serializers.BooleanField(allow_null=True)
    paddle_type = TracePaddleTypeSerializer(allow_null=True)
    finding_code = serializers.CharField()
    epi_week = serializers.CharField()
    is_lagged = serializers.BooleanField()
    voided_at = serializers.DateTimeField(allow_null=True)
    void_reason = serializers.CharField(allow_blank=True)
    capture = TraceCaptureSerializer(allow_null=True)
    photos = TracePhotoSerializer(many=True)


class TraceInstalledSerializer(Base):
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)
    basis = serializers.CharField(help_text="placement or previous_reading")
    exposure_days = serializers.IntegerField(allow_null=True)


class TraceCodeSerializer(Base):
    id = serializers.UUIDField()
    code = serializers.CharField()


class TracePointSerializer(TraceCodeSerializer):
    location = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    version = serializers.IntegerField()


class TraceAreaSerializer(TraceCodeSerializer):
    geometry = serializers.JSONField(allow_null=True)


class TraceCenterSerializer(TraceCodeSerializer):
    name = serializers.CharField()


class TraceLocationSerializer(Base):
    ovitrap = TraceCodeSerializer()
    point = TracePointSerializer()
    block = TraceAreaSerializer()
    quadrant = TraceAreaSerializer()
    center = TraceCenterSerializer()


class TraceReceiptSerializer(Base):
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)


class TraceCountSerializer(Base):
    id = serializers.UUIDField()
    ordinal = serializers.IntegerField()
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)
    replaces = serializers.UUIDField(allow_null=True)
    void = TraceVoidSerializer(allow_null=True)


class TraceRejectionSerializer(Base):
    id = serializers.UUIDField()
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)
    reason = serializers.CharField(allow_blank=True)
    void = TraceVoidSerializer(allow_null=True)


class TraceRecountSerializer(Base):
    role = serializers.CharField()
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)


class TraceAttemptSerializer(Base):
    revision = serializers.IntegerField()
    status = serializers.CharField()
    result = serializers.CharField(allow_null=True)
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)


class TracePcrSerializer(Base):
    target = serializers.CharField()
    outcome = serializers.CharField()
    at = serializers.DateTimeField()
    by = TraceActorSerializer(allow_null=True)


class TraceSampleSerializer(Base):
    sample_code = serializers.CharField()
    received_at = serializers.DateTimeField(allow_null=True)
    results = TraceAttemptSerializer(many=True)
    pcr = TracePcrSerializer(many=True)


class TraceLabSerializer(Base):
    status = serializers.CharField()
    receipt = TraceReceiptSerializer(allow_null=True)
    counts = TraceCountSerializer(many=True)
    rejections = TraceRejectionSerializer(many=True)
    recounts = TraceRecountSerializer(many=True)
    wolbachia = TraceSampleSerializer(many=True)


class BagTraceSerializer(Base):
    bag = TraceCodeSerializer()
    reading = TraceReadingSerializer()
    installed = TraceInstalledSerializer()
    location = TraceLocationSerializer()
    lab = TraceLabSerializer(allow_null=True)
