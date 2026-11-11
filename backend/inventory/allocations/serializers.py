"""Closed custody/disposal commands; numeric quantities never pass through float."""

from decimal import Decimal
from typing import Any

from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.author_names import AuthorNamesMixin
from inventory.allocations.permissions import INTENT_KINDS
from inventory.allocations.policy import validate_supply_note
from ovitraps.payloads import StrictPayloadSerializer

MAX_SUPPLY_ITEMS = 1000


@extend_schema_field(
    {"type": "string", "enum": ["place", "check"]}, component_name="SupplyMappingActionEnum"
)
class SupplyMappingActionField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["place", "check"], **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["manual_evidence_review"]}, component_name="SupplyTransitModeEnum"
)
class SupplyTransitModeField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["manual_evidence_review"], **kwargs)


@extend_schema_field(
    {"type": "string", "enum": ["signature", "rpbi", "photo"]},
    component_name="SupplyEvidenceRoleEnum",
)
class SupplyEvidenceRoleField(serializers.ChoiceField):
    def __init__(self, **kwargs: Any) -> None:  # noqa: ANN401 -- DRF field options
        super().__init__(choices=["signature", "rpbi", "photo"], **kwargs)


class SupplyQuantityField(serializers.DecimalField):
    def to_internal_value(self, data: Any) -> Decimal:  # noqa: ANN401 -- exact wire scalar boundary
        if isinstance(data, (float, bool)):
            self.fail("invalid")
        return super().to_internal_value(data)


def quantity_field() -> SupplyQuantityField:
    return SupplyQuantityField(max_digits=20, decimal_places=6, min_value=Decimal("0.000001"))


class EvidenceRoleSerializer(StrictPayloadSerializer):
    upload_id = serializers.UUIDField()
    role = SupplyEvidenceRoleField()


class AssignmentLineSerializer(StrictPayloadSerializer):
    id = serializers.UUIDField()
    lot_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True, default=None)
    unit_version_id = serializers.UUIDField()
    quantity = quantity_field()


class CreateAssignmentSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    courier_id = serializers.UUIDField()
    origin_id = serializers.UUIDField()
    date = serializers.DateField()
    shift_id = serializers.UUIDField(allow_null=True, default=None)
    lines = serializers.ListSerializer[dict[str, Any]](
        child=AssignmentLineSerializer(), allow_empty=False, max_length=MAX_SUPPLY_ITEMS
    )

    def validate_lines(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        identities = {(row["lot_id"], row["piece_id"], row["unit_version_id"]) for row in rows}
        if len({row["id"] for row in rows}) != len(rows) or len(identities) != len(rows):
            raise serializers.ValidationError("Duplicate assignment identity.")
        return rows


class ReviseAssignmentSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=1)
    lines = serializers.ListSerializer[dict[str, Any]](
        child=AssignmentLineSerializer(), allow_empty=False, max_length=MAX_SUPPLY_ITEMS
    )

    validate_lines = CreateAssignmentSerializer.validate_lines


class IntentBaseSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    evidence = serializers.ListSerializer[dict[str, Any]](
        child=EvidenceRoleSerializer(), max_length=MAX_SUPPLY_ITEMS, default=list
    )

    def validate_evidence(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len({row["upload_id"] for row in rows}) != len(rows):
            raise serializers.ValidationError("One declared role per upload.")
        return rows


class ReasonedIntentSerializer(IntentBaseSerializer):
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)

    def validate_reason(self, reason: str) -> str:
        return validate_supply_note(reason, field="reason")


class AssignmentReleaseIntentSerializer(IntentBaseSerializer):
    kind = serializers.ChoiceField(choices=["assignment_release"])
    assignment_id = serializers.UUIDField()


class ReleaseCancelIntentSerializer(ReasonedIntentSerializer):
    kind = serializers.ChoiceField(choices=["release_cancel"])
    release_id = serializers.UUIDField()


class ReturnAcceptIntentSerializer(IntentBaseSerializer):
    kind = serializers.ChoiceField(choices=["return_accept"])
    declaration_id = serializers.UUIDField()
    quantity = quantity_field()


class ReconcileJustifyIntentSerializer(ReasonedIntentSerializer):
    kind = serializers.ChoiceField(choices=["reconcile_justify"])
    reconciliation_id = serializers.UUIDField()
    discrepancy_id = serializers.UUIDField()


class LotWriteOffIntentSerializer(ReasonedIntentSerializer):
    kind = serializers.ChoiceField(choices=["lot_write_off"])
    lot_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True, default=None)
    unit_version_id = serializers.UUIDField()
    quantity = quantity_field()
    owner_id = serializers.UUIDField()
    date = serializers.DateField()


class BagDisposalIntentSerializer(ReasonedIntentSerializer):
    kind = serializers.ChoiceField(choices=["bag_disposal"])
    bag_id = serializers.UUIDField()
    owner_id = serializers.UUIDField()
    date = serializers.DateField()


class PrepareInventoryIntentSerializer(serializers.Serializer[Any]):
    kinds = dict(
        zip(
            INTENT_KINDS,
            (
                AssignmentReleaseIntentSerializer,
                ReleaseCancelIntentSerializer,
                ReturnAcceptIntentSerializer,
                ReconcileJustifyIntentSerializer,
                LotWriteOffIntentSerializer,
                BagDisposalIntentSerializer,
            ),
            strict=True,
        )
    )

    def to_internal_value(self, data: Any) -> dict[str, Any]:  # noqa: ANN401 -- closed DRF wire union
        kind = data.get("kind") if isinstance(data, dict) else None
        if not isinstance(kind, str) or kind not in self.kinds:
            raise serializers.ValidationError({"kind": ["invalid_choice"]})
        value = self.kinds[kind](data=data)
        value.is_valid(raise_exception=True)
        return dict(value.validated_data)


class PrepareInventoryIntentSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]  # Spectacular's registration hook is untyped.
    target_class = PrepareInventoryIntentSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- drf-spectacular extension boundary
        refs = {
            name: auto_schema.resolve_serializer(kind(), direction).ref["$ref"]
            for name, kind in PrepareInventoryIntentSerializer.kinds.items()
        }
        return {
            "required": ["kind"],
            "oneOf": [{"$ref": ref} for ref in refs.values()],
            "discriminator": {"propertyName": "kind", "mapping": refs},
        }


class ExecuteInventoryIntentSerializer(StrictPayloadSerializer):
    intent_id = serializers.UUIDField()


class ActualSupplyLineSerializer(StrictPayloadSerializer):
    id = serializers.UUIDField()
    release_line_id = serializers.UUIDField()
    quantity = SupplyQuantityField(max_digits=20, decimal_places=6, min_value=Decimal(0))


class SupplyReceivePayload(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    assignment_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    plan_revision = serializers.IntegerField(min_value=1)
    release_id = serializers.UUIDField()
    # Null only when the release already carries the warehouse-screen signature.
    signature_upload_id = serializers.UUIDField(allow_null=True, default=None)
    actual_lines = serializers.ListSerializer[dict[str, Any]](
        child=ActualSupplyLineSerializer(), allow_empty=False, max_length=MAX_SUPPLY_ITEMS
    )
    discrepancies = serializers.ListField(
        child=serializers.CharField(max_length=200), max_length=MAX_SUPPLY_ITEMS, default=list
    )

    def validate_actual_lines(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len({row["release_line_id"] for row in rows}) != len(rows) or len(
            {row["id"] for row in rows}
        ) != len(rows):
            raise serializers.ValidationError("One actual observation per release line.")
        return rows


class SupplyUseDeltaSerializer(StrictPayloadSerializer):
    receipt_line_id = serializers.UUIDField()
    receipt_source_event_id = serializers.UUIDField()
    quantity = quantity_field()
    work_kind = serializers.ChoiceField(choices=["field_event", "manual"])
    work_source_id = serializers.UUIDField(required=False)
    manual_reason = serializers.CharField(required=False, max_length=1000, trim_whitespace=False)
    transit_policy_id = serializers.UUIDField()
    transit_evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=MAX_SUPPLY_ITEMS, allow_empty=False
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        field = attrs["work_kind"] == "field_event"
        if field != ("work_source_id" in attrs) or field == ("manual_reason" in attrs):
            raise serializers.ValidationError({"work_kind": "incoherent_source"})
        if not field:
            attrs["manual_reason"] = validate_supply_note(
                attrs["manual_reason"], field="manual_reason"
            )
        return attrs


class SupplyReturnDeltaSerializer(StrictPayloadSerializer):
    receipt_line_id = serializers.UUIDField()
    receipt_source_event_id = serializers.UUIDField()
    destination_id = serializers.UUIDField()
    quantity = quantity_field()


class SupplyShrinkageDeltaSerializer(StrictPayloadSerializer):
    receipt_line_id = serializers.UUIDField()
    receipt_source_event_id = serializers.UUIDField()
    quantity = quantity_field()
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField(max_length=1000, trim_whitespace=False)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=MAX_SUPPLY_ITEMS, allow_empty=False
    )

    def validate_reason(self, reason: str) -> str:
        return validate_supply_note(reason, field="reason")


class SupplyReconcilePayload(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    assignment_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    used = serializers.ListSerializer[dict[str, Any]](
        child=SupplyUseDeltaSerializer(), max_length=MAX_SUPPLY_ITEMS, default=list
    )
    returned = serializers.ListSerializer[dict[str, Any]](
        child=SupplyReturnDeltaSerializer(), max_length=MAX_SUPPLY_ITEMS, default=list
    )
    shrinkage = serializers.ListSerializer[dict[str, Any]](
        child=SupplyShrinkageDeltaSerializer(), max_length=MAX_SUPPLY_ITEMS, default=list
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not any(attrs[key] for key in ("used", "returned", "shrinkage")):
            raise serializers.ValidationError({"used": "empty_reconciliation"})
        return attrs


class SupplyDateRangeQuerySerializer(serializers.Serializer[Any]):
    date = serializers.DateField(required=False)
    center = serializers.UUIDField(required=False)
    created_at_from = serializers.DateTimeField(required=False)
    created_at_before = serializers.DateTimeField(required=False)
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at"], required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start, before = attrs.get("created_at_from"), attrs.get("created_at_before")
        if start is not None and before is not None and before <= start:
            raise serializers.ValidationError({"created_at_before": "invalid_range"})
        return attrs


class SupplyQuerySerializer(SupplyDateRangeQuerySerializer):
    courier = serializers.UUIDField(required=False)
    assignment = serializers.UUIDField(required=False)


class AssignmentQuerySerializer(SupplyQuerySerializer):
    status = serializers.ChoiceField(
        choices=["planned", "released", "cancelled", "received"], required=False
    )


class SupplySuggestionQuerySerializer(serializers.Serializer[Any]):
    date = serializers.DateField()
    courier = serializers.UUIDField(required=False)


class WriteOffQuerySerializer(SupplyDateRangeQuerySerializer):
    kind = serializers.ChoiceField(choices=["lot", "bag"], required=False)
    reason_code = serializers.CharField(max_length=64, required=False)


class TransitPolicySerializer(StrictPayloadSerializer):
    supply_version_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    name = serializers.CharField(max_length=200)
    procedure = serializers.CharField()
    reference = serializers.CharField()
    mode = SupplyTransitModeField()
    proof_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=["photo"]), allow_empty=False
    )
    is_active = serializers.BooleanField()


class MaterialMappingSerializer(StrictPayloadSerializer):
    supply_version_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)
    action = SupplyMappingActionField()
    quantity = quantity_field()
    reference = serializers.CharField()
    is_active = serializers.BooleanField()


class SupplyFrameLineSerializer(serializers.Serializer[Any]):
    assignment_line_id = serializers.UUIDField()
    plan_revision = serializers.IntegerField(min_value=1)
    planned = serializers.CharField()
    credited = serializers.CharField(allow_null=True)
    used = serializers.CharField()
    returned = serializers.CharField()
    shrinkage = serializers.CharField()
    difference = serializers.CharField(allow_null=True)
    delivery_variance = serializers.CharField(allow_null=True)


class SupplyFrameSerializer(serializers.Serializer[Any]):
    assignment_id = serializers.UUIDField()
    lines = SupplyFrameLineSerializer(many=True)


class AssignmentSignatureSerializer(serializers.Serializer[Any]):
    state = serializers.ChoiceField(choices=["signed", "pending_phone"])
    channel = serializers.ChoiceField(
        choices=["warehouse_screen", "courier_device"], allow_null=True
    )
    captured_by = serializers.CharField(allow_null=True)


class AssignmentLifecycleSerializer(serializers.Serializer[Any]):
    signature = AssignmentSignatureSerializer(allow_null=True)
    status = serializers.ChoiceField(choices=["planned", "released", "cancelled", "received"])
    release_id = serializers.UUIDField(allow_null=True)
    released_at = serializers.DateTimeField(allow_null=True)
    released_by_name = serializers.CharField(allow_null=True)
    cancelled_at = serializers.DateTimeField(allow_null=True)
    cancelled_by_name = serializers.CharField(allow_null=True)
    cancel_reason_code = serializers.CharField(allow_null=True)
    cancel_reason = serializers.CharField(allow_null=True)


class SupplyAssignmentReadSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    courier_id = serializers.UUIDField()
    origin_id = serializers.UUIDField()
    date = serializers.DateField()
    shift_id = serializers.UUIDField(allow_null=True)
    revision = serializers.IntegerField(min_value=1)
    version_id = serializers.UUIDField()
    planning_proof = serializers.DictField()
    lines = AssignmentLineSerializer(many=True)
    lifecycle = AssignmentLifecycleSerializer(required=False)


class AssignmentOutcomeSerializer(serializers.Serializer[Any]):
    assignment = SupplyAssignmentReadSerializer()


class SupplyReconciliationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    assignment = SupplyAssignmentReadSerializer()
    revision = serializers.IntegerField(min_value=0)
    frame_id = serializers.UUIDField(allow_null=True)
    frame = SupplyFrameSerializer(allow_null=True)
    discrepancy_id = serializers.UUIDField(allow_null=True)
    justification_ids = serializers.ListField(child=serializers.UUIDField())


class SupplyIntentSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=INTENT_KINDS)
    expected_revision = serializers.IntegerField(min_value=0)
    input_hash = serializers.CharField()
    evidence = EvidenceRoleSerializer(many=True)


class PreparedIntentOutcomeSerializer(serializers.Serializer[Any]):
    intent = SupplyIntentSerializer()


class SupplyReleaseSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    assignment_id = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    proof = serializers.DictField()


class ReleaseOutcomeSerializer(serializers.Serializer[Any]):
    release = SupplyReleaseSerializer()


class SupplyCancellationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    release_id = serializers.UUIDField()


class CancellationOutcomeSerializer(serializers.Serializer[Any]):
    cancellation = SupplyCancellationSerializer()


class SupplyReturnAcceptanceSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    declaration_id = serializers.UUIDField()
    quantity = serializers.CharField()
    revision = serializers.IntegerField(min_value=1)


class ReturnAcceptanceOutcomeSerializer(serializers.Serializer[Any]):
    acceptance = SupplyReturnAcceptanceSerializer()


class SupplyJustificationSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    frame_id = serializers.UUIDField()


class JustificationOutcomeSerializer(serializers.Serializer[Any]):
    justification = SupplyJustificationSerializer()


class WriteOffAuditSerializer(AuthorNamesMixin, serializers.Serializer[Any]):
    owner_id = serializers.UUIDField()
    date = serializers.DateField()
    reason_code = serializers.CharField()
    reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    created_by = serializers.UUIDField()
    rpbi_upload_id = serializers.UUIDField(allow_null=True)


class LotWriteOffReadSerializer(WriteOffAuditSerializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["lot"])
    lot_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    quantity = serializers.CharField()
    piece_id = serializers.UUIDField(allow_null=True)
    unit_version_id = serializers.UUIDField()


class BagDisposalReadSerializer(WriteOffAuditSerializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["bag"])
    bag_id = serializers.UUIDField()
    reading_id = serializers.UUIDField()
    source_event_id = serializers.UUIDField()
    collector_id = serializers.UUIDField()
    dependency_proof = serializers.DictField()


class WriteOffReadSerializer(serializers.Serializer[Any]):
    def to_representation(self, instance: Any) -> dict[str, Any]:  # noqa: ANN401 -- closed actual source response
        owner = (
            LotWriteOffReadSerializer if instance["kind"] == "lot" else BagDisposalReadSerializer
        )
        return dict(owner(instance).data)


class WriteOffReadSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]  # Spectacular's registration hook is untyped.
    target_class = WriteOffReadSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- spectacular protocol
        lot = auto_schema.resolve_serializer(LotWriteOffReadSerializer(), direction).ref
        bag = auto_schema.resolve_serializer(BagDisposalReadSerializer(), direction).ref
        return {
            "oneOf": [lot, bag],
            "discriminator": {
                "propertyName": "kind",
                "mapping": {"lot": lot["$ref"], "bag": bag["$ref"]},
            },
        }


class WriteOffOutcomeSerializer(serializers.Serializer[Any]):
    write_off = WriteOffReadSerializer()


class SupplyExecutionBodySerializer(serializers.Serializer[Any]):
    release = SupplyReleaseSerializer(required=False)
    cancellation = SupplyCancellationSerializer(required=False)
    acceptance = SupplyReturnAcceptanceSerializer(required=False)
    justification = SupplyJustificationSerializer(required=False)
    write_off = WriteOffReadSerializer(required=False)


class SupplySavedExecutionSerializer(serializers.Serializer[Any]):
    status = serializers.IntegerField()
    response = SupplyExecutionBodySerializer()
    written_revision = serializers.IntegerField()


class InventoryIntentReadSerializer(PreparedIntentOutcomeSerializer):
    execution = SupplySavedExecutionSerializer(allow_null=True)


class SupplySuggestionLineSerializer(serializers.Serializer[Any]):
    supply_version_id = serializers.UUIDField()
    mapping_id = serializers.UUIDField()
    quantity = serializers.CharField()


class SupplySuggestionSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=["unavailable", "unconfigured", "assessed"])
    date = serializers.DateField()
    courier_id = serializers.UUIDField()
    lines = SupplySuggestionLineSerializer(many=True)
    schedule_revision = serializers.IntegerField(required=False)
    unconfigured_actions = serializers.ListField(child=SupplyMappingActionField(), required=False)


class SupplyConfigurationReadSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    supply_version_id = serializers.UUIDField()
    revision = serializers.IntegerField()
    is_active = serializers.BooleanField()
    reference = serializers.CharField()
    name = serializers.CharField(required=False)
    procedure = serializers.CharField(required=False)
    mode = SupplyTransitModeField(required=False)
    proof_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=["photo"]), required=False
    )
    action = SupplyMappingActionField(required=False)
    quantity = serializers.CharField(required=False)


class SupplyReleasedLineSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    assignment_line_id = serializers.UUIDField()
    quantity = serializers.CharField()
    transit_policy_id = serializers.UUIDField(allow_null=True)


class SupplyReleaseBundleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    plan_revision = serializers.IntegerField(min_value=1)
    manifest_hash = serializers.CharField()
    lines = SupplyReleasedLineSerializer(many=True)


class SupplyReceiptBundleSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    event_id = serializers.UUIDField()
    source_event_id = serializers.UUIDField()
    release_id = serializers.UUIDField()
    signature_upload_id = serializers.UUIDField()
    voided = serializers.BooleanField()
    lines = ActualSupplyLineSerializer(many=True)


class SupplyBundleSerializer(SupplyAssignmentReadSerializer):
    organization_id = serializers.UUIDField()
    center_id = serializers.UUIDField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    reconciliation = SupplyReconciliationSerializer(allow_null=True)
    releases = SupplyReleaseBundleSerializer(many=True)
    receipts = SupplyReceiptBundleSerializer(many=True)
