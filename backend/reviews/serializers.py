from typing import Any

from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from reviews.models import CODE_MAX_LENGTH, ReviewItem, ReviewKind


class ReviewItemSerializer(OrgScopedModelSerializer):
    """A review item for the supervisor's list: what was flagged, why (`code` + `params`) and who
    sent it. The event itself (payload, times) comes with the review screens of #22."""

    event_id = serializers.UUIDField(source="field_event_id", read_only=True)

    class Meta:
        model = ReviewItem
        fields = [
            "id",
            "event_id",
            "event_type",
            "kind",
            "code",
            "params",
            "courier",
            "device",
            "created_at",
        ]
        read_only_fields = fields


class ReviewItemFilterSerializer(serializers.Serializer[Any]):
    """Query parameters of `GET /review-items/`."""

    kind = serializers.ChoiceField(choices=ReviewKind.choices, required=False)
    code = serializers.CharField(max_length=CODE_MAX_LENGTH, required=False)
