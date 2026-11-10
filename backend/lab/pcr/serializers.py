"""Explicit request and response schemas of the PCR endpoints."""

from typing import Any

from rest_framework import serializers

from lab.pcr.models import OUTCOMES, SEROTYPES, STATUSES, TARGETS


class ExternalLabSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=200)
    contact = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")
    address = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")
    is_active = serializers.BooleanField(required=False, default=True)


class ExternalLabUpdateSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(max_length=200, required=False)
    contact = serializers.CharField(max_length=200, allow_blank=True, required=False)
    address = serializers.CharField(max_length=500, allow_blank=True, required=False)
    is_active = serializers.BooleanField(required=False)


class ExternalLabQuerySerializer(serializers.Serializer[Any]):
    active = serializers.BooleanField(required=False, allow_null=True, default=None)


class PcrBatchCreateSerializer(serializers.Serializer[Any]):
    external_lab_id = serializers.UUIDField()
    targets = serializers.ListField(
        child=serializers.ChoiceField(choices=TARGETS), min_length=1, max_length=2
    )
    sample_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=500)
    notes = serializers.CharField(max_length=1000, allow_blank=True, required=False, default="")


class PcrBatchQuerySerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=STATUSES, required=False)
    external_lab = serializers.UUIDField(required=False)
    search = serializers.CharField(max_length=100, required=False, allow_blank=True)
    shipped_from = serializers.DateField(required=False)
    shipped_to = serializers.DateField(required=False)
    include_voided = serializers.BooleanField(required=False, default=False)


class EligibleSampleQuerySerializer(serializers.Serializer[Any]):
    quadrant = serializers.UUIDField(required=False)
    epi_week = serializers.CharField(max_length=10, required=False, allow_blank=True)
    search = serializers.CharField(max_length=100, required=False, allow_blank=True)


class PcrStepSerializer(serializers.Serializer[Any]):
    occurred_at = serializers.DateTimeField(required=False, allow_null=True, default=None)


class PcrShipSerializer(PcrStepSerializer):
    carrier = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")
    tracking_number = serializers.CharField(max_length=100)
    evidence_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class PcrReasonSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)


class PcrResultRowSerializer(serializers.Serializer[Any]):
    sample_id = serializers.UUIDField()
    target = serializers.ChoiceField(choices=TARGETS)
    outcome = serializers.ChoiceField(choices=OUTCOMES)
    serotype = serializers.ChoiceField(
        choices=["", *SEROTYPES], required=False, allow_blank=True, default=""
    )
    ct_value = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=0,
        max_value=60,
        required=False,
        allow_null=True,
        default=None,
    )


class PcrResultsSerializer(serializers.Serializer[Any]):
    rows = PcrResultRowSerializer(many=True, min_length=1, max_length=2000)  # type: ignore[call-arg]


class PcrResultsPreviewSerializer(serializers.Serializer[Any]):
    content = serializers.CharField(max_length=200_000, trim_whitespace=False)


class PcrReportSerializer(serializers.Serializer[Any]):
    upload_id = serializers.UUIDField()


# Responses -----------------------------------------------------------------------------------


class PcrBatchRowSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    external_lab_id = serializers.UUIDField()
    external_lab_name = serializers.CharField()
    targets = serializers.ListField(child=serializers.ChoiceField(choices=TARGETS))
    sample_count = serializers.IntegerField()
    status = serializers.ChoiceField(choices=STATUSES)
    shipped_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class PcrSampleEntrySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()
    quadrant_code = serializers.CharField(allow_null=True)
    quadrant_name = serializers.CharField(allow_null=True)
    center_name = serializers.CharField()
    epi_week = serializers.CharField(allow_null=True)
    collected_at = serializers.DateTimeField()


class PcrEventSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(
        choices=["ready", "ship", "receive", "results", "close", "undo", "void"]
    )
    occurred_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    author_name = serializers.CharField()
    carrier = serializers.CharField(allow_blank=True)
    tracking_number = serializers.CharField(allow_blank=True)
    has_evidence = serializers.BooleanField()
    evidence_type = serializers.CharField(allow_null=True)
    undone = serializers.BooleanField()
    reason = serializers.CharField(allow_blank=True)


class PcrResultSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    sample_id = serializers.UUIDField()
    sample_code = serializers.CharField()
    target = serializers.ChoiceField(choices=TARGETS)
    outcome = serializers.ChoiceField(choices=OUTCOMES)
    serotype = serializers.CharField(allow_blank=True)
    ct_value = serializers.CharField(allow_null=True)
    author_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    current = serializers.BooleanField()
    voided = serializers.BooleanField()
    void_reason = serializers.CharField(allow_blank=True)
    superseded = serializers.BooleanField()


class PcrReportFileSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    content_type = serializers.CharField()
    size_bytes = serializers.IntegerField()
    author_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class PcrLabSummarySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    contact = serializers.CharField(allow_blank=True)
    address = serializers.CharField(allow_blank=True)


class PcrBatchDetailSerializer(PcrBatchRowSerializer):
    external_lab = PcrLabSummarySerializer()
    notes = serializers.CharField(allow_blank=True)
    author_name = serializers.CharField()
    samples = PcrSampleEntrySerializer(many=True)
    events = PcrEventSerializer(many=True)
    results = PcrResultSerializer(many=True)
    reports = PcrReportFileSerializer(many=True)


class PcrStatusCountsSerializer(serializers.Serializer[Any]):
    preparing = serializers.IntegerField()
    ready_to_ship = serializers.IntegerField()
    shipped = serializers.IntegerField()
    received_by_lab = serializers.IntegerField()
    results_received = serializers.IntegerField()
    closed = serializers.IntegerField()
    voided = serializers.IntegerField()


class PcrBatchPageSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = PcrBatchRowSerializer(many=True)
    status_counts = PcrStatusCountsSerializer()


class PcrSummarySerializer(serializers.Serializer[Any]):
    in_process = serializers.IntegerField()
    pending_results = serializers.IntegerField()


class PcrRowErrorSerializer(serializers.Serializer[Any]):
    field = serializers.CharField()
    code = serializers.CharField()
    params = serializers.DictField()


class PcrPreviewRowSerializer(serializers.Serializer[Any]):
    line = serializers.IntegerField()
    sample_code = serializers.CharField(allow_blank=True)
    sample_id = serializers.UUIDField(allow_null=True)
    target = serializers.ChoiceField(choices=TARGETS, allow_null=True)
    outcome = serializers.ChoiceField(choices=OUTCOMES, allow_null=True)
    serotype = serializers.CharField(allow_blank=True)
    ct_value = serializers.CharField(allow_null=True)
    errors = PcrRowErrorSerializer(many=True)


class PcrPreviewSerializer(serializers.Serializer[Any]):
    rows = PcrPreviewRowSerializer(many=True)
    valid_count = serializers.IntegerField()
    error_count = serializers.IntegerField()
    file_error = serializers.CharField(allow_null=True)
