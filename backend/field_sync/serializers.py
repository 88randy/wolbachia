"""Request and response bodies of `POST /field/sync/` (docs/sync.md)."""

import re
from typing import Any

from rest_framework import serializers

from field_sync.cursor import CURSOR_MAX_LENGTH
from field_sync.envelope import (
    MAX_PLAUSIBLE_TIME,
    MIN_PLAUSIBLE_TIME,
    EventEnvelope,
    GpsFix,
    describe_payload,
)
from field_sync.models import TYPE_MAX_LENGTH, VERSION_MAX_LENGTH, EventStatus
from field_sync.producers import MapManifestSerializer
from field_sync.projection_serializers import (
    OvitrapBundleSerializer,
    QuadrantReferenceSerializer,
    SamplingPointBundleSerializer,
)
from reviews.models import ReviewKind

MAX_LATITUDE = 90
MAX_LONGITUDE = 180
MAX_SCHEMA_VERSION = 32767  # PositiveSmallIntegerField
EVENT_TYPE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$")


def reject_unencodable_text(value: str) -> None:
    """A lone surrogate cannot be stored (PostgreSQL text is UTF-8): refuse it at the edge."""
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise serializers.ValidationError("Not valid text.", code="invalid_text") from None


class SafeDateTimeField(serializers.DateTimeField):
    """A datetime that never raises `OverflowError` for extreme values near the calendar limits."""

    def to_internal_value(self, value: Any) -> Any:  # noqa: ANN401
        try:
            return super().to_internal_value(value)
        except OverflowError:
            self.fail("invalid", format=self.format)


def validate_plausible_time(value: Any) -> None:  # noqa: ANN401
    if not MIN_PLAUSIBLE_TIME <= value < MAX_PLAUSIBLE_TIME:
        raise serializers.ValidationError("Out of range.", code="out_of_range")


class GpsSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField(min_value=-MAX_LATITUDE, max_value=MAX_LATITUDE)
    lng = serializers.FloatField(min_value=-MAX_LONGITUDE, max_value=MAX_LONGITUDE)
    accuracy_m = serializers.FloatField(min_value=0, required=False, allow_null=True, default=None)


class SyncEventSerializer(serializers.Serializer[Any]):
    """The envelope of one event. `payload` is a JSON object; its content is the handler's."""

    id = serializers.UUIDField()
    type = serializers.RegexField(EVENT_TYPE_PATTERN, max_length=TYPE_MAX_LENGTH)
    schema_version = serializers.IntegerField(min_value=1, max_value=MAX_SCHEMA_VERSION)
    device_time = SafeDateTimeField()
    payload = serializers.DictField()
    shift_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    gps = GpsSerializer(required=False, allow_null=True, default=None)
    rules_version = serializers.CharField(
        max_length=VERSION_MAX_LENGTH, allow_blank=True, validators=[reject_unencodable_text]
    )
    catalog_version = serializers.CharField(
        max_length=VERSION_MAX_LENGTH, allow_blank=True, validators=[reject_unencodable_text]
    )
    manual_capture = serializers.BooleanField(default=False)
    voids_event_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class SyncBatchSerializer(serializers.Serializer[Any]):
    """The batch: who sends it, the phone's clock at send time, the pull cursor and the events.

    An empty `events` list is a pure pull. The number of events is limited before this runs
    (`413`), so the limit is not a validation error.
    """

    device_id = serializers.UUIDField()
    sent_at = SafeDateTimeField(validators=[validate_plausible_time])
    cursor = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        max_length=CURSOR_MAX_LENGTH,
        validators=[reject_unencodable_text],
    )
    events = SyncEventSerializer(many=True, allow_empty=True)


def build_envelopes(events: list[dict[str, Any]]) -> list[EventEnvelope]:
    """Turn validated events into envelopes, remembering their position in the request."""
    return [_build_envelope(index, event) for index, event in enumerate(events)]


def _build_envelope(index: int, event: dict[str, Any]) -> EventEnvelope:
    gps = event["gps"]
    payload = dict(event["payload"])
    return EventEnvelope(
        index=index,
        id=event["id"],
        type=event["type"],
        schema_version=event["schema_version"],
        device_time=event["device_time"],
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version=event["rules_version"],
        catalog_version=event["catalog_version"],
        manual_capture=event["manual_capture"],
        shift_id=event["shift_id"],
        gps=None if gps is None else GpsFix(gps["lat"], gps["lng"], gps["accuracy_m"]),
        voids_event_id=event["voids_event_id"],
    )


class EventResultSerializer(serializers.Serializer[Any]):
    """One ingestion verdict. rejection_quota_exceeded is not stored: retain and retry the event
    after params.retry_after_seconds (also the 200 response's Retry-After header)."""

    id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=EventStatus.choices)
    code = serializers.CharField()
    params = serializers.DictField()


class ReviewChangeSerializer(serializers.Serializer[Any]):
    """A review item as the phone's inbox sees it (the courier's own events only)."""

    id = serializers.UUIDField()
    event_id = serializers.UUIDField(source="field_event_id")
    kind = serializers.ChoiceField(choices=ReviewKind.choices)
    code = serializers.CharField()
    params = serializers.DictField()
    created_at = serializers.DateTimeField()


class ProducerChangeSerializer(serializers.Serializer[Any]):
    sequence = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=["upsert", "remove"])
    resource_type = serializers.CharField()
    resource_id = serializers.CharField()
    resource_version = serializers.CharField()
    data = serializers.DictField()  # type: ignore[assignment]  # Required wire name overlaps Serializer.data.


class QuadrantChangeSerializer(ProducerChangeSerializer):
    action = serializers.ChoiceField(choices=["upsert"])
    data = QuadrantReferenceSerializer()  # type: ignore[assignment]


class SamplingPointChangeSerializer(ProducerChangeSerializer):
    action = serializers.ChoiceField(choices=["upsert"])
    data = SamplingPointBundleSerializer()  # type: ignore[assignment]


class OvitrapChangeSerializer(ProducerChangeSerializer):
    action = serializers.ChoiceField(choices=["upsert"])
    data = OvitrapBundleSerializer()  # type: ignore[assignment]


class ChangesSerializer(serializers.Serializer[Any]):
    cursor = serializers.CharField(allow_null=True)
    reviews = ReviewChangeSerializer(many=True)
    catalog_version = serializers.CharField(allow_null=True)
    rules_version = serializers.CharField(allow_null=True)
    has_more = serializers.BooleanField()
    next_change_at = serializers.DateTimeField(allow_null=True)
    assignments = ProducerChangeSerializer(many=True)
    supplies = ProducerChangeSerializer(many=True)
    permits = ProducerChangeSerializer(many=True)
    eligibility = ProducerChangeSerializer(many=True)
    history = ProducerChangeSerializer(many=True)
    map_manifests = ProducerChangeSerializer(many=True)
    quadrants = QuadrantChangeSerializer(many=True)
    sampling_points = SamplingPointChangeSerializer(many=True)
    ovitraps = OvitrapChangeSerializer(many=True)


class SyncResponseSerializer(serializers.Serializer[Any]):
    server_time = serializers.DateTimeField()
    results = EventResultSerializer(many=True)
    changes = ChangesSerializer()


class BootstrapSerializer(serializers.Serializer[Any]):
    bundle_version = serializers.CharField()
    schema_version = serializers.CharField()
    generated_at = serializers.DateTimeField()
    scope_revision = serializers.CharField()
    cursor = serializers.CharField()
    catalog_version = serializers.CharField()
    rules_version = serializers.CharField()
    next_change_at = serializers.DateTimeField(allow_null=True)
    map_manifest_ready = serializers.BooleanField()
    assignments = serializers.ListField(child=serializers.DictField())
    supplies = serializers.ListField(child=serializers.DictField())
    permits = serializers.ListField(child=serializers.DictField())
    eligibility = serializers.ListField(child=serializers.DictField())
    history = serializers.ListField(child=serializers.DictField())
    map_manifests = MapManifestSerializer(many=True)
    quadrants = QuadrantReferenceSerializer(many=True)
    sampling_points = SamplingPointBundleSerializer(many=True)
    ovitraps = OvitrapBundleSerializer(many=True)
