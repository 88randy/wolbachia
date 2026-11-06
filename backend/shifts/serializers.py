from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.exceptions import FieldValidationError
from core.serializers import OrgScopedModelSerializer
from reviews.detail_serializers import ShiftValidationSerializer
from reviews.serializers import ShiftDecisionSerializer
from shifts.models import MotorcycleCheck, Shift, ShiftStatus
from shifts.selectors import ShiftFilters


class MotorcycleCheckSerializer(OrgScopedModelSerializer):
    """One checklist line; `item_code` is the code of the catalog item."""

    item_code = serializers.CharField(source="item.code", read_only=True)

    class Meta:
        model = MotorcycleCheck
        fields = ["id", "item", "item_code", "result", "note"]
        read_only_fields = fields


class ShiftSerializer(OrgScopedModelSerializer):
    """A shift as the supervisor sees it. Times marked `_device` are the phone's clock; the events
    (`opened_event`, `closed_event`) carry the server receipt time. No user-facing text."""

    motorcycle_code = serializers.CharField(source="motorcycle.code", read_only=True)
    checks = MotorcycleCheckSerializer(many=True, read_only=True)

    class Meta:
        model = Shift
        fields = [
            "id",
            "courier",
            "device",
            "motorcycle",
            "motorcycle_code",
            "status",
            "opened_at_device",
            "opened_event",
            "odometer_open_km",
            "open_note",
            "closed_at_device",
            "closed_event",
            "odometer_close_km",
            "close_note",
            "checks",
            "created_at",
        ]
        read_only_fields = fields


class ShiftDetailSerializer(ShiftSerializer):
    validation = serializers.SerializerMethodField()
    validation_timeline = serializers.SerializerMethodField()

    class Meta(ShiftSerializer.Meta):
        fields = [*ShiftSerializer.Meta.fields, "validation", "validation_timeline"]
        read_only_fields = fields

    @extend_schema_field(ShiftValidationSerializer)
    def get_validation(self, obj: Shift) -> dict[str, Any]:
        from shifts.validation import validation_projection

        return validation_projection(obj)

    @extend_schema_field(ShiftDecisionSerializer(many=True))
    def get_validation_timeline(self, obj: Shift) -> list[dict[str, Any]]:
        return list(ShiftDecisionSerializer(obj.decisions.order_by("revision"), many=True).data)


class ShiftFilterSerializer(serializers.Serializer[Any]):
    """Query parameters of `GET /shifts/`. `date_from` and `date_to` are inclusive calendar dates
    in the organization's time zone, compared with the phone's opening time."""

    status = serializers.ChoiceField(choices=ShiftStatus.choices, required=False)
    courier = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        date_from, date_to = attrs.get("date_from"), attrs.get("date_to")
        if date_from is not None and date_to is not None and date_from > date_to:
            raise FieldValidationError("date_to", "date_range_inverted")
        return attrs

    def to_filters(self) -> ShiftFilters:
        """The validated query as `ShiftFilters`, dates turned into instants of the organization's
        time zone (`context["timezone"]`)."""
        data = self.validated_data
        zone = ZoneInfo(self.context["timezone"])
        date_from, date_to = data.get("date_from"), data.get("date_to")
        return ShiftFilters(
            status=data.get("status"),
            courier=data.get("courier"),
            opened_from=None if date_from is None else datetime.combine(date_from, time.min, zone),
            opened_before=(
                None
                if date_to is None
                else datetime.combine(date_to + timedelta(days=1), time.min, zone)
            ),
        )
