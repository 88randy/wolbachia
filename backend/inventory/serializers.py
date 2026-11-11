"""Explicit mutation contracts and read-only immutable inventory projections."""

from datetime import datetime, time
from decimal import Decimal
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.utils.functional import cached_property
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.filters import CodeQuerySerializer
from core.serializers import OrgScopedModelSerializer
from field_sync.envelope import MAX_PLAUSIBLE_TIME, MIN_PLAUSIBLE_TIME
from geography.geometry import validate_location
from inventory.models import (
    BiologicalProtocolVersion,
    ConditionIncidentLink,
    ConditionReading,
    LocationVersion,
    LotVersion,
    StockMovement,
    SupplyTypeVersion,
)
from inventory.policy import BIOLOGICAL_FIELDS, LotSafety
from inventory.selectors import lot_safety
from organizations.scope import EffectiveScope
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


class ExplicitConditionWriteSerializer(ConditionWriteSerializer):
    location_id = serializers.UUIDField()


class ProtocolSerializer(OrgScopedModelSerializer):
    incident_type = serializers.SerializerMethodField()

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "required": ["incident_type_version_id", "code", "label"],
            "properties": {
                "incident_type_version_id": {"type": "string", "format": "uuid"},
                "code": {"type": "string"},
                "label": {"type": "string"},
            },
        }
    )
    def get_incident_type(self, protocol: BiologicalProtocolVersion) -> dict[str, Any] | None:
        incident_type = protocol.incident_type
        if incident_type is None:
            return None
        return {
            "incident_type_version_id": incident_type.pk,
            "code": incident_type.code,
            "label": incident_type.label,
        }

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
            "incident_type",
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
    owner_label = serializers.SerializerMethodField()

    def get_owner_label(self, version: LocationVersion) -> str:
        return version.owner.user.get_full_name().strip() or version.owner.user.username

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
            "owner_label",
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


class RetainedLocationSerializer(OrgScopedModelSerializer):
    code = serializers.CharField(source="location.code", read_only=True)

    class Meta:
        model = LocationVersion
        fields = ["id", "location_id", "code", "name"]
        read_only_fields = fields


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
    supply_version = SupplySerializer(read_only=True)
    location_version = RetainedLocationSerializer(read_only=True, allow_null=True)
    admission_id = serializers.UUIDField(source="lot.admission.pk", read_only=True, allow_null=True)
    safety_location_id = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = LotVersion
        fields = [
            "id",
            "code",
            "version",
            "revision",
            "supply",
            "supply_version_id",
            "supply_version",
            "admission_id",
            "center",
            "quadrant",
            "protocol_id",
            "initial_location_id",
            "location_version_id",
            "location_version",
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
            "safety_location_id",
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
            cache[version.pk] = lot_safety(version, location=self.context.get("custody_location"))
        return cache[version.pk]

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_safety_location_id(self, version: LotVersion) -> str | None:
        location = self.context.get("custody_location")
        identifier = location.pk if location is not None else version.initial_location_id
        return str(identifier) if identifier else None

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_created_by(self, version: LotVersion) -> str | None:
        if "request" not in self.context:
            return None
        original = self.reader_scope.allows(
            "lot.read",
            str(version.lot.center_id),
            str(version.lot.quadrant_id) if version.lot.quadrant_id else None,
        )
        return str(version.created_by_id) if original and version.created_by_id else None

    @cached_property
    def safety_cache(self) -> dict[UUID, LotSafety]:
        return {}

    @cached_property
    def reader_scope(self) -> EffectiveScope:
        """Loaded once: a list reuses one child serializer for every row."""
        return current_scope(actor_from_request(self.context["request"]))

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
        location = self.context.get("custody_location")
        identifier = location.pk if location is not None else version.initial_location_id
        if identifier is None:
            return None
        return f"/api/v1/locations/{identifier}/stock/?lot={version.lot_id}"


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
            "capture_mode",
            "capture_location_id",
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
        from inventory.conditions import reading_context

        context = reading_context(reading)
        return current_scope(actor).allows(
            "incident.read",
            str(context.center_id),
            str(context.quadrant_id) if context.quadrant_id else None,
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


class ConditionStatusQuerySerializer(StrictPayloadSerializer):
    location_id = serializers.UUIDField(required=False)


class ConditionSlotSerializer(serializers.Serializer[Any]):
    slot = serializers.ChoiceField(choices=[0, 1])
    window = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=1440),
        min_length=2,
        max_length=2,
        allow_null=True,
    )
    is_complete = serializers.BooleanField()
    reading_id = serializers.UUIDField(allow_null=True)


class ConditionBlockingIncidentSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    code = serializers.CharField()


class ConditionStatusSerializer(serializers.Serializer[Any]):
    lot_id = serializers.UUIDField()
    lot_version_id = serializers.UUIDField()
    protocol_id = serializers.UUIDField(allow_null=True)
    location_id = serializers.UUIDField(allow_null=True)
    evaluated_at = serializers.DateTimeField()
    local_date = serializers.DateField()
    timezone = serializers.CharField()
    protocol = ProtocolSerializer(allow_null=True)
    is_protocol_configured = serializers.BooleanField()
    can_create_condition = serializers.BooleanField()
    slots = ConditionSlotSerializer(many=True)
    status = serializers.ChoiceField(choices=["draft", "available", "blocked"])
    blocked_by = serializers.ListField(child=serializers.CharField())
    blocking_incidents = ConditionBlockingIncidentSerializer(many=True)


class StockSerializer(serializers.Serializer[Any]):
    lot = serializers.UUIDField(source="lot_id")
    lot_code = serializers.CharField(source="lot__code")
    supply = serializers.UUIDField(source="lot__supply_id")
    piece_id = serializers.UUIDField(allow_null=True)
    quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    unit = serializers.CharField(source="unit_version__unit")
    source_ids = serializers.ListField(child=serializers.UUIDField())


@extend_schema_field(
    {"oneOf": [{"type": "string", "format": "uuid"}, {"type": "string", "enum": ["none"]}]}
)
class OptionalReferenceField(serializers.Field[UUID | str, Any, str, Any]):
    """Explicit `none` is a missing applicable reference, never an inferred scope."""

    def to_internal_value(self, value: Any) -> UUID | str:  # noqa: ANN401
        return "none" if value == "none" else serializers.UUIDField().to_internal_value(value)

    def to_representation(self, value: UUID | str) -> str:
        return str(value)


class InventoryQuerySerializer(serializers.Serializer[Any]):
    supply = serializers.UUIDField(required=False)
    location = serializers.UUIDField(required=False)
    custody_location = serializers.UUIDField(required=False)
    location_id = serializers.UUIDField(required=False)
    lot = serializers.UUIDField(required=False)
    lot_code = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    center = serializers.UUIDField(required=False)
    status = serializers.ChoiceField(choices=["draft", "available", "blocked"], required=False)
    is_active = serializers.ChoiceField(choices=["true", "false"], required=False)
    is_biological = serializers.ChoiceField(choices=["true", "false"], required=False)
    is_insecticide_free = serializers.ChoiceField(choices=["true", "false"], required=False)
    identity_kind = serializers.ChoiceField(choices=["piece", "lot"], required=False)
    kind = serializers.ChoiceField(choices=["biofactory", "warehouse", "center"], required=False)
    expiry_from = serializers.DateTimeField(required=False)
    expiry_before = serializers.DateTimeField(required=False)
    expiry_from_date = serializers.DateField(required=False)
    expiry_before_date = serializers.DateField(required=False)
    blocked_by = serializers.ChoiceField(
        choices=[
            "supply_type_inactive",
            "lot_expired",
            "protocol_not_configured",
            "storage_safety_not_configured",
            "insecticide_free_required",
            "condition_slot_missing",
            "condition_breach",
            "transfer_discrepancy_hold",
        ],
        required=False,
    )
    operation = serializers.UUIDField(required=False)
    piece = OptionalReferenceField(required=False)
    unit = serializers.CharField(required=False, trim_whitespace=False)
    created_at_from = serializers.DateTimeField(required=False)
    created_at_before = serializers.DateTimeField(required=False)
    device_time_from = serializers.DateTimeField(required=False)
    device_time_before = serializers.DateTimeField(required=False)
    local_date = serializers.DateField(required=False)
    evaluation = serializers.ChoiceField(choices=["normal", "breach", "unassessed"], required=False)

    def validate_lot_code(self, value: str) -> str:
        """Reuse the public code grammar while retaining this query field's error path."""
        query = CodeQuerySerializer(data={"code": value})
        if not query.is_valid():
            raise serializers.ValidationError(query.errors["code"])
        return str(query.validated_data["code"])

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = self._expiry_bounds(attrs)
        for prefix in ("expiry", "device_time", "created_at"):
            start, end = attrs.get(f"{prefix}_from"), attrs.get(f"{prefix}_before")
            if start is not None and end is not None and end <= start:
                raise serializers.ValidationError({f"{prefix}_before": "Invalid range."})
        return attrs

    def _expiry_bounds(self, attrs: dict[str, Any]) -> dict[str, Any]:
        for bound in ("from", "before"):
            name = f"expiry_{bound}"
            date_name = f"{name}_date"
            if date_name not in attrs:
                continue
            if name in attrs:
                raise serializers.ValidationError(
                    {date_name: "Use a date or an instant, not both."}
                )
            local = ZoneInfo(self.context["timezone"])
            attrs[name] = datetime.combine(attrs.pop(date_name), time.min, tzinfo=local)
        return attrs


class MovementSerializer(OrgScopedModelSerializer):
    # This DTO is emitted only by current Location queries, which exclude Assignment legs.
    location_id = serializers.UUIDField(read_only=True)
    lot_code = serializers.CharField(source="lot.code", read_only=True)
    supply_id = serializers.UUIDField(source="lot.supply_id", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True)
    unit = serializers.CharField(source="unit_version.unit", read_only=True)
    source_kind = serializers.ChoiceField(
        source="operation.source_kind",
        choices=[
            "lot_admission",
            "transfer_dispatch",
            "transfer_receive",
            "transfer_resolution",
            "supply_receive",
            "supply_reconcile",
            "supply_return",
            "lot_write_off",
            "supply_compensation",
            "paddle_return",
        ],
        read_only=True,
    )
    source_id = serializers.UUIDField(source="operation.source_id", read_only=True)
    source_transfer = serializers.SerializerMethodField()
    source_supply = serializers.SerializerMethodField()

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": [
                        "supply_receive",
                        "supply_reconcile",
                        "supply_return",
                        "lot_write_off",
                        "supply_compensation",
                    ],
                },
                "id": {"type": "string", "format": "uuid"},
                "assignment_id": {"type": "string", "format": "uuid", "nullable": True},
                "source_event_id": {"type": "string", "format": "uuid", "nullable": True},
            },
            "required": ["kind", "id", "assignment_id", "source_event_id"],
        }
    )
    def get_source_supply(self, movement: StockMovement) -> dict[str, str | None] | None:
        from inventory.allocations.selectors import (
            movement_supply_source,
            movement_supply_visibility,
        )

        request = self.context.get("supply_request")
        if request is None or movement.operation.supply_source_id is None:
            return None
        context = cast(dict[str, Any], self.context)
        cache = "_supply_movement_visibility"
        if cache not in context:
            rows = self.root.instance
            if rows is None or isinstance(rows, StockMovement):
                rows = [movement]
            context[cache] = movement_supply_visibility(actor_from_request(request), rows)
        return movement_supply_source(movement, context[cache])

    @extend_schema_field(
        {
            "type": "object",
            "nullable": True,
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "code": {"type": "string"},
                "event_id": {"type": "string", "format": "uuid"},
            },
            "required": ["id", "code", "event_id"],
        }
    )
    def get_source_transfer(self, movement: StockMovement) -> dict[str, str] | None:
        from inventory.transfers.scope import allows_transfer_vector, transfer_contexts

        event = movement.operation.transfer_event
        if event is None or "request" not in self.context:
            return None
        actor = actor_from_request(self.context["request"])
        if not allows_transfer_vector(
            current_scope(actor), "transfer.read", transfer_contexts(event.transfer)
        ):
            return None
        return {
            "id": str(event.transfer_id),
            "code": event.transfer.code,
            "event_id": str(event.pk),
        }

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "operation_id",
            "line_number",
            "lot_id",
            "lot_code",
            "supply_id",
            "location_id",
            "location_code",
            "piece_id",
            "quantity",
            "unit",
            "unit_version_id",
            "source_kind",
            "source_id",
            "source_transfer",
            "source_supply",
            "created_at",
            "created_by",
        ]
        read_only_fields = fields


class OwnerOptionSerializer(serializers.Serializer[Any]):
    membership_id = serializers.UUIDField(source="pk")
    label = serializers.CharField()  # type: ignore[assignment]  # resource field shadows DRF label


class PlacementOptionSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(
        choices=["quadrant", "center_only", "location", "center_only_draft"]
    )
    quadrant_id = serializers.UUIDField(allow_null=True)
    code = serializers.CharField(source="choice_code", allow_null=True)
    location_id = serializers.UUIDField(allow_null=True)
    is_read_only = serializers.BooleanField()

    def to_representation(self, instance: Any) -> dict[str, Any]:  # noqa: ANN401
        result = dict(super().to_representation(instance))
        if result["kind"] in ("quadrant", "center_only"):
            result.pop("location_id")
            result.pop("is_read_only")
        return result


class QuadrantPlacementOptionSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=["quadrant", "center_only"])
    quadrant_id = serializers.UUIDField(allow_null=True)
    code = serializers.CharField(allow_null=True)


class LotPlacementOptionSerializer(QuadrantPlacementOptionSerializer):
    kind = serializers.ChoiceField(choices=["location", "center_only_draft"])
    location_id = serializers.UUIDField(allow_null=True)
    is_read_only = serializers.BooleanField()


class ProtocolTypeOptionSerializer(serializers.Serializer[Any]):
    incident_type_version_id = serializers.UUIDField(source="pk")
    code = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]  # resource field shadows DRF label


class OptionQuerySerializer(StrictPayloadSerializer):
    search = serializers.CharField(required=False, allow_blank=True)
    page = serializers.IntegerField(required=False, min_value=1)
    page_size = serializers.IntegerField(required=False, min_value=1)


class OwnerOptionQuerySerializer(OptionQuerySerializer):
    center = serializers.UUIDField(required=False)
    quadrant = OptionalReferenceField(required=False)
    location = serializers.UUIDField(required=False)
    ordering = serializers.ChoiceField(choices=["label", "-label"], required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "location" in attrs:
            if "center" in attrs or "quadrant" in attrs:
                raise serializers.ValidationError(
                    {"location": "Use only the location reference for update."}
                )
        elif "center" not in attrs or "quadrant" not in attrs:
            raise serializers.ValidationError(
                {"center": "Both center and quadrant are required for create."}
            )
        if "quadrant" in attrs:
            attrs["quadrant"] = None if attrs["quadrant"] == "none" else attrs["quadrant"]
        return attrs


class PlacementOptionQuerySerializer(OptionQuerySerializer):
    action = serializers.ChoiceField(choices=["location.create", "lot.create"], required=False)
    center = serializers.UUIDField(required=False)
    lot = serializers.UUIDField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if "lot" in attrs:
            if "action" in attrs or "center" in attrs:
                raise serializers.ValidationError({"lot": "Use only the lot reference for update."})
        elif "action" not in attrs or "center" not in attrs:
            raise serializers.ValidationError(
                {"action": "Action and center are required for create."}
            )
        return attrs


class ProtocolTypeOptionQuerySerializer(OptionQuerySerializer):
    supply = serializers.UUIDField(required=False)
