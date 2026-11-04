"""Request and response bodies of `POST /field/sync/` (docs/sync.md)."""

import re
from typing import Any

from rest_framework import serializers

from field_sync.cursor import CURSOR_MAX_LENGTH
from field_sync.envelope import EventEnvelope, GpsFix, describe_payload
from field_sync.models import EventStatus
from reviews.models import ReviewKind

MAX_LATITUDE = 90
MAX_LONGITUDE = 180
MAX_SCHEMA_VERSION = 32767  # PositiveSmallIntegerField
EVENT_TYPE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$")
EVENT_TYPE_MAX_LENGTH = 64
VERSION_TOKEN_MAX_LENGTH = 64


class GpsSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField(min_value=-MAX_LATITUDE, max_value=MAX_LATITUDE)
    lng = serializers.FloatField(min_value=-MAX_LONGITUDE, max_value=MAX_LONGITUDE)
    accuracy_m = serializers.FloatField(min_value=0)


class SyncEventSerializer(serializers.Serializer[Any]):
    """The envelope of one event. `payload` is a JSON object; its content is the handler's."""

    id = serializers.UUIDField()
    type = serializers.RegexField(EVENT_TYPE_PATTERN, max_length=EVENT_TYPE_MAX_LENGTH)
    schema_version = serializers.IntegerField(min_value=1, max_value=MAX_SCHEMA_VERSION)
    device_time = serializers.DateTimeField()
    payload = serializers.DictField()
    shift_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    gps = GpsSerializer(required=False, allow_null=True, default=None)
    rules_version = serializers.CharField(max_length=VERSION_TOKEN_MAX_LENGTH, allow_blank=True)
    catalog_version = serializers.CharField(max_length=VERSION_TOKEN_MAX_LENGTH, allow_blank=True)
    manual_capture = serializers.BooleanField(default=False)
    voids_event_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class SyncBatchSerializer(serializers.Serializer[Any]):
    """The batch: who sends it, the phone's clock at send time, the pull cursor and the events.

    An empty `events` list is a pure pull. The number of events is limited before this runs
    (`413`), so the limit is not a validation error.
    """

    device_id = serializers.UUIDField()
    sent_at = serializers.DateTimeField()
    cursor = serializers.CharField(
        required=False, allow_null=True, allow_blank=False, max_length=CURSOR_MAX_LENGTH
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


class ChangesSerializer(serializers.Serializer[Any]):
    cursor = serializers.CharField(allow_null=True)
    reviews = ReviewChangeSerializer(many=True)
    catalog_version = serializers.CharField(allow_null=True)
    rules_version = serializers.CharField(allow_null=True)
    has_more = serializers.BooleanField()


class SyncResponseSerializer(serializers.Serializer[Any]):
    server_time = serializers.DateTimeField()
    results = EventResultSerializer(many=True)
    changes = ChangesSerializer()
