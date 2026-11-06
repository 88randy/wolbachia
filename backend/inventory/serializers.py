"""Explicit mutation contracts and read-only immutable inventory projections."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.utils.functional import cached_property
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from field_sync.envelope import MAX_PLAUSIBLE_TIME, MIN_PLAUSIBLE_TIME
from geography.geometry import validate_location
from inventory.models import (
    BiologicalProtocolVersion,
    ConditionIncidentLink,
    ConditionReading,
    LocationVersion,
    LotVersion,
    SupplyTypeVersion,
)
from inventory.policy import BIOLOGICAL_FIELDS, LotSafety
from inventory.selectors import lot_safety
from ovitraps.payloads import StrictPayloadSerializer
from uploads.access import actor_from_request, current_scope


class InventoryRevisionSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0)


class ProtocolWriteSerializer(StrictPayloadSerializer):
    name = serializers.CharField(max_length=200, allow_blank=True, required=False)
    shelf_life_seconds = serializers.IntegerField(
        min_value=1, max_value=2**63 - 1, allow_null=True, required=False
    )
    expiry_basis = serializers.ChoiceField(choices=["", "laid_on"], required=False)
    temperature_min = serializers.DecimalField(
        max_digits=12, decimal_places=6, allow_null=True, required=False
    )
    temperature_max = serializers.DecimalField(
        max_digits=12, decimal_places=6, allow_null=True, required=False
    )
    humidity_min = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=0, max_value=100, allow_null=True, required=False
    )
    humidity_max = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=0, max_value=100, allow_null=True, required=False
    )
    reading_windows = serializers.ListField(
        child=serializers.ListField(
            child=serializers.IntegerField(min_value=0, max_value=1440), min_length=2, max_length=2
        ),
        max_length=2,
        required=False,
    )
    required_fields = serializers.ListField(
        child=serializers.ChoiceField(choices=BIOLOGICAL_FIELDS), required=False
    )
    incident_type_id = serializers.UUIDField(allow_null=True, required=False)

    def validate_reading_windows(self, value: list[list[int]]) -> list[list[int]]:
        if not value:
            return value
        if (
            len(value) != 2
            or any(start >= end for start, end in value)
            or value[0][1] > value[1][0]
        ):
            raise serializers.ValidationError(
                "Two ordered nonoverlapping windows are required.", code="invalid_reading_windows"
            )
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        for prefix in ("temperature", "humidity"):
            low, high = attrs.get(f"{prefix}_min"), attrs.get(f"{prefix}_max")
            if low is not None and high is not None and low > high:
                raise serializers.ValidationError({f"{prefix}_max": "Invalid range."})
        return attrs


class SupplyWriteSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0, default=0)
    code = serializers.CharField(max_length=50)
    label = serializers.CharField(max_length=200)  # type: ignore[assignment]  # resource field shadows DRF's label attribute
    unit = serializers.CharField(max_length=24)
    identity_kind = serializers.ChoiceField(choices=["piece", "lot"])
    is_biological = serializers.BooleanField()
    is_chemical = serializers.BooleanField(allow_null=True, required=False)
    requires_insecticide_free = serializers.BooleanField(allow_null=True, required=False)
    expiry_required = serializers.BooleanField(allow_null=True, required=False)
    specification = serializers.CharField(max_length=4000, allow_blank=True, required=False)
    protocol = ProtocolWriteSerializer(required=False)


@extend_schema_field(
    {
        "type": "object",
        "required": ["type", "coordinates"],
        "properties": {
            "type": {"type": "string", "enum": ["Point"]},
            "coordinates": {
                "type": "array",
                "items": {"type": "number"},
                "minItems": 2,
                "maxItems": 2,
            },
        },
    }
)
class PointField(serializers.JSONField):
    def to_internal_value(self, value: object) -> dict[str, Any]:
        if (
            not isinstance(value, dict)
            or set(value) != {"type", "coordinates"}
            or value.get("type") != "Point"
        ):
            raise serializers.ValidationError(
                "A GeoJSON Point is required.", code="invalid_geometry"
            )
        try:
            return {"type": "Point", "coordinates": validate_location(value["coordinates"])}
        except ValueError as error:
            raise serializers.ValidationError(
                "Invalid coordinates.", code="invalid_geometry"
            ) from error


class LocationWriteSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0, default=0)
    code = serializers.CharField(max_length=50)
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True, required=False)
    name = serializers.CharField(max_length=200)
    kind = serializers.ChoiceField(choices=["biofactory", "warehouse", "center"])
    geometry = PointField()
    owner_id = serializers.UUIDField()
    is_insecticide_free = serializers.BooleanField(allow_null=True, required=False)


class LotWriteSerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0, default=0)
    code = serializers.CharField(max_length=50)
    supply_id = serializers.UUIDField()
    supply_version_id = serializers.UUIDField(required=False)
    protocol_id = serializers.UUIDField(required=False, allow_null=True)
    center_id = serializers.UUIDField(required=False)
    initial_location_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.DecimalField(
        max_digits=20,
        decimal_places=6,
        min_value=Decimal("0.000001"),
        required=False,
        allow_null=True,
    )
    provenance = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    species = serializers.CharField(max_length=120, required=False, allow_blank=True)
    strain = serializers.CharField(max_length=120, required=False, allow_blank=True)
    generation = serializers.CharField(max_length=120, required=False, allow_blank=True)
    laid_on = serializers.DateField(required=False, allow_null=True)
    estimated_organism_count = serializers.DecimalField(
        max_digits=20,
        decimal_places=6,
        min_value=Decimal("0.000001"),
        required=False,
        allow_null=True,
    )
    observations = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs.get("expires_at") is not None and attrs.get("expiry_date") is not None:
            raise serializers.ValidationError(
                {"expiry_date": "Use a date or an instant, not both."}
            )
        for field in ("laid_on", "expiry_date"):
            if (
                attrs.get(field) is not None
                and not MIN_PLAUSIBLE_TIME.date() <= attrs[field] < MAX_PLAUSIBLE_TIME.date()
            ):
                raise serializers.ValidationError({field: "Date outside the supported window."})
        if attrs.get("expires_at") is not None:
            validate_instant(attrs["expires_at"])
        return attrs


def validate_instant(value: datetime) -> None:
    if not MIN_PLAUSIBLE_TIME <= value < MAX_PLAUSIBLE_TIME:
        raise serializers.ValidationError(
            "Timestamp outside the supported window.", code="out_of_range"
        )


class ConditionWriteSerializer(StrictPayloadSerializer):
    device_time = serializers.DateTimeField(validators=[validate_instant])
    temperature_c = serializers.DecimalField(max_digits=12, decimal_places=6)
    humidity_pct = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=0, max_value=100
    )


class ProtocolSerializer(OrgScopedModelSerializer):
    class Meta:
        model = BiologicalProtocolVersion
        fields = [
            "id",
            "name",
            "shelf_life_seconds",
            "expiry_basis",
            "temperature_min",
            "temperature_max",
            "humidity_min",
            "humidity_max",
            "reading_windows",
            "required_fields",
            "incident_type_id",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class SupplySerializer(OrgScopedModelSerializer):
    id = serializers.UUIDField(source="supply_type_id", read_only=True)
    code = serializers.CharField(source="supply_type.code", read_only=True)
    version = serializers.UUIDField(source="pk", read_only=True)
    protocol = ProtocolSerializer(read_only=True, allow_null=True)

    class Meta:
        model = SupplyTypeVersion
        fields = [
            "id",
            "code",
            "version",
            "revision",
            "label",
            "unit",
            "identity_kind",
            "is_biological",
            "is_chemical",
            "requires_insecticide_free",
            "expiry_required",
            "specification",
            "is_active",
            "protocol",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class LocationSerializer(OrgScopedModelSerializer):
    id = serializers.UUIDField(source="location_id", read_only=True)
    code = serializers.CharField(source="location.code", read_only=True)
    version = serializers.UUIDField(source="pk", read_only=True)
    center = serializers.UUIDField(source="location.center_id", read_only=True)
    quadrant = serializers.UUIDField(source="location.quadrant_id", read_only=True, allow_null=True)
    geometry = PointField(read_only=True)

    class Meta:
        model = LocationVersion
        fields = [
            "id",
            "code",
            "version",
            "revision",
            "center",
            "quadrant",
            "name",
            "kind",
            "geometry",
            "owner_id",
            "is_insecticide_free",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class InventoryBlockerSerializer(serializers.Serializer[Any]):
    reason = serializers.CharField()
    unblocked_by_role = serializers.CharField()
    link = serializers.CharField(allow_blank=True)
    current_revision = serializers.IntegerField(required=False)


class LotSerializer(OrgScopedModelSerializer):
    id = serializers.UUIDField(source="lot_id", read_only=True)
    code = serializers.CharField(source="lot.code", read_only=True)
    version = serializers.UUIDField(source="pk", read_only=True)
    supply = serializers.UUIDField(source="lot.supply_id", read_only=True)
    center = serializers.UUIDField(source="lot.center_id", read_only=True)
    quadrant = serializers.UUIDField(source="lot.quadrant_id", read_only=True, allow_null=True)
    status = serializers.SerializerMethodField()
    missing_fields = serializers.SerializerMethodField()
    blocked_by = serializers.SerializerMethodField()
    expiry = serializers.DateTimeField(source="expires_at", read_only=True, allow_null=True)
    stock_url = serializers.SerializerMethodField()

    class Meta:
        model = LotVersion
        fields = [
            "id",
            "code",
            "version",
            "revision",
            "supply",
            "supply_version_id",
            "center",
            "quadrant",
            "protocol_id",
            "initial_location_id",
            "location_version_id",
            "quantity",
            "provenance",
            "species",
            "strain",
            "generation",
            "laid_on",
            "estimated_organism_count",
            "observations",
            "expiry",
            "expiry_date",
            "timezone",
            "status",
            "missing_fields",
            "blocked_by",
            "stock_url",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields

    def _safety(self, version: LotVersion) -> LotSafety:
        cache = self.safety_cache
        if version.pk not in cache:
            cache[version.pk] = lot_safety(version)
        return cache[version.pk]

    @cached_property
    def safety_cache(self) -> dict[UUID, LotSafety]:
        return {}

    @extend_schema_field({"type": "string", "enum": ["draft", "available", "blocked"]})
    def get_status(self, version: LotVersion) -> str:
        return self._safety(version).status

    def get_missing_fields(self, version: LotVersion) -> list[str]:
        return list(self._safety(version).missing_fields)

    @extend_schema_field(InventoryBlockerSerializer(many=True))
    def get_blocked_by(self, version: LotVersion) -> list[dict[str, str]]:
        return [
            {"reason": code, "unblocked_by_role": "warehouse", "link": ""}
            for code in self._safety(version).blocked_by
        ]

    def get_stock_url(self, version: LotVersion) -> str | None:
        if version.initial_location_id is None:
            return None
        return f"/api/v1/locations/{version.initial_location_id}/stock/?lot={version.lot_id}"


class ConditionSerializer(OrgScopedModelSerializer):
    range = ProtocolSerializer(source="protocol", read_only=True, allow_null=True)
    incident = serializers.SerializerMethodField()
    pending_incident = serializers.SerializerMethodField()

    class Meta:
        model = ConditionReading
        fields = [
            "id",
            "lot_id",
            "lot_version_id",
            "location_version_id",
            "device_time",
            "server_received_at",
            "temperature_c",
            "humidity_pct",
            "local_date",
            "slot",
            "timezone",
            "evaluation",
            "range",
            "incident",
            "pending_incident",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields

    def _can_read_incident(self, reading: ConditionReading) -> bool:
        actor = actor_from_request(self.context["request"])
        return current_scope(actor).allows(
            "incident.read",
            str(reading.lot.center_id),
            str(reading.lot.quadrant_id) if reading.lot.quadrant_id else None,
        )

    def get_incident(self, reading: ConditionReading) -> str | None:
        if not self._can_read_incident(reading):
            return None
        link = ConditionIncidentLink.objects.filter(breach__reading=reading).first()
        return str(link.incident_id) if link else None

    def get_pending_incident(self, reading: ConditionReading) -> bool | None:
        if not self._can_read_incident(reading):
            return None
        return (
            reading.evaluation == "breach"
            and not ConditionIncidentLink.objects.filter(breach__reading=reading).exists()
        )


class StockSerializer(serializers.Serializer[Any]):
    lot = serializers.UUIDField(source="lot_id")
    lot_code = serializers.CharField(source="lot__code")
    supply = serializers.UUIDField(source="lot__supply_id")
    piece_id = serializers.UUIDField(allow_null=True)
    quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    unit = serializers.CharField(source="unit_version__unit")
    source_ids = serializers.ListField(child=serializers.UUIDField())


class InventoryQuerySerializer(serializers.Serializer[Any]):
    supply = serializers.UUIDField(required=False)
    location = serializers.UUIDField(required=False)
    lot = serializers.UUIDField(required=False)
    center = serializers.UUIDField(required=False)
    status = serializers.ChoiceField(choices=["draft", "available", "blocked"], required=False)
    is_active = serializers.ChoiceField(choices=["true", "false"], required=False)
    is_biological = serializers.ChoiceField(choices=["true", "false"], required=False)
    is_insecticide_free = serializers.ChoiceField(choices=["true", "false"], required=False)
    identity_kind = serializers.ChoiceField(choices=["piece", "lot"], required=False)
    kind = serializers.ChoiceField(choices=["biofactory", "warehouse", "center"], required=False)
    expiry_from = serializers.DateTimeField(required=False)
    expiry_before = serializers.DateTimeField(required=False)
    device_time_from = serializers.DateTimeField(required=False)
    device_time_before = serializers.DateTimeField(required=False)
    local_date = serializers.DateField(required=False)
    evaluation = serializers.ChoiceField(choices=["normal", "breach", "unassessed"], required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        for prefix in ("expiry", "device_time"):
            start, end = attrs.get(f"{prefix}_from"), attrs.get(f"{prefix}_before")
            if start is not None and end is not None and end <= start:
                raise serializers.ValidationError({f"{prefix}_before": "Invalid range."})
        return attrs
