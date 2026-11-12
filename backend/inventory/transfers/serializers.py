"""Closed custody input unions and exact immutable manifest projections."""

from decimal import Decimal
from typing import Any

from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from core.serializers import OrgScopedModelSerializer
from inventory.models import QUANTITY_DIGITS, QUANTITY_PLACES
from inventory.transfers.models import (
    Discrepancy,
    DiscrepancyLine,
    Transfer,
    TransferEvent,
    TransferHold,
    TransferLine,
)
from ovitraps.payloads import StrictPayloadSerializer

MAX_TRANSFER_ITEMS = 1000  # Technical JSON/SQL work bound, not a biological or stock threshold.


def quantity_field() -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, min_value=Decimal("0.000001")
    )


class PrepareLineSerializer(StrictPayloadSerializer):
    lot_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True)
    unit_version_id = serializers.UUIDField()
    quantity = quantity_field()


class PrepareTransferSerializer(StrictPayloadSerializer):
    code = serializers.CharField(max_length=50)
    origin_id = serializers.UUIDField()
    destination_id = serializers.UUIDField()
    lines: serializers.ListSerializer[dict[str, Any]] = serializers.ListSerializer(
        child=PrepareLineSerializer(), allow_empty=False, max_length=MAX_TRANSFER_ITEMS
    )

    def validate_lines(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        identities = {(row["lot_id"], row["piece_id"], row["unit_version_id"]) for row in rows}
        pieces = [row["piece_id"] for row in rows if row["piece_id"] is not None]
        if len(identities) != len(rows) or len(pieces) != len(set(pieces)):
            raise serializers.ValidationError(
                "Duplicate expected identity.", code="transfer_identity_conflict"
            )
        return rows


class DispatchTransferSerializer(StrictPayloadSerializer):
    command_id = serializers.UUIDField()
    signature_upload_id = serializers.UUIDField()
    expected_revision = serializers.IntegerField(min_value=0)


class ExpectedScanSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["expected"])
    scan_id = serializers.UUIDField()
    line_id = serializers.UUIDField()
    quantity = quantity_field()


class IdentifiedExtraSerializer(PrepareLineSerializer):
    kind = serializers.ChoiceField(choices=["identified_extra"])
    scan_id = serializers.UUIDField()


class UnidentifiedExtraSerializer(StrictPayloadSerializer):
    kind = serializers.ChoiceField(choices=["unidentified_extra"])
    scan_id = serializers.UUIDField()
    unidentified_code = serializers.CharField(max_length=200)
    quantity = quantity_field()


class ClosedScanSerializer(serializers.Serializer[Any]):
    kinds = {
        "expected": ExpectedScanSerializer,
        "identified_extra": IdentifiedExtraSerializer,
        "unidentified_extra": UnidentifiedExtraSerializer,
    }

    def to_internal_value(self, data: Any) -> dict[str, Any]:  # noqa: ANN401 -- closed DRF wire union
        kind = data.get("kind") if isinstance(data, dict) else None
        if not isinstance(kind, str) or kind not in self.kinds:
            raise serializers.ValidationError({"kind": ["invalid_choice"]})
        value = self.kinds[kind](data=data)
        value.is_valid(raise_exception=True)
        return dict(value.validated_data)


class ClosedScanSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]  # spectacular's external registry hook has no annotation
    target_class = ClosedScanSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- schema protocol
        references = {
            kind: auto_schema.resolve_serializer(serializer(), direction).ref
            for kind, serializer in ClosedScanSerializer.kinds.items()
        }
        return {
            "oneOf": list(references.values()),
            "discriminator": {
                "propertyName": "kind",
                "mapping": {kind: reference["$ref"] for kind, reference in references.items()},
            },
        }


class MissingAssertionSerializer(StrictPayloadSerializer):
    line_id = serializers.UUIDField()
    quantity = quantity_field()
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=MAX_TRANSFER_ITEMS
    )


class ReceiveTransferSerializer(DispatchTransferSerializer):
    scanned: serializers.ListSerializer[dict[str, Any]] = serializers.ListSerializer(
        child=ClosedScanSerializer(), allow_empty=True, max_length=MAX_TRANSFER_ITEMS
    )
    missing: serializers.ListSerializer[dict[str, Any]] = serializers.ListSerializer(
        child=MissingAssertionSerializer(), allow_empty=True, max_length=MAX_TRANSFER_ITEMS
    )
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=True, max_length=MAX_TRANSFER_ITEMS
    )
    dispatch_source_event_id = serializers.UUIDField(required=False)


class DispatchTransferPayload(DispatchTransferSerializer):
    transfer_id = serializers.UUIDField()


class ReceiveTransferPayload(ReceiveTransferSerializer):
    transfer_id = serializers.UUIDField()


class AcknowledgeMissingSerializer(StrictPayloadSerializer):
    line_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["ack_missing"])
    quantity = quantity_field()


class ReceivingOutcomeSerializer(StrictPayloadSerializer):
    line_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["recover_dest", "return_origin"])
    quantity = quantity_field()
    dispatch_event_id = serializers.UUIDField()
    receipt_event_id = serializers.UUIDField()
    signature_upload_id = serializers.UUIDField()


class CorrectionOutcomeSerializer(StrictPayloadSerializer):
    line_id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["reference_signed_correction"])
    quantity = quantity_field()
    correction_transfer_id = serializers.UUIDField()
    receipt_event_id = serializers.UUIDField()


class ClosedOutcomeSerializer(ClosedScanSerializer):
    kinds = {
        "ack_missing": AcknowledgeMissingSerializer,
        "recover_dest": ReceivingOutcomeSerializer,
        "return_origin": ReceivingOutcomeSerializer,
        "reference_signed_correction": CorrectionOutcomeSerializer,
    }


class ClosedOutcomeSchema(OpenApiSerializerExtension):  # type: ignore[no-untyped-call]  # same external registry hook
    target_class = ClosedOutcomeSerializer

    def map_serializer(self, auto_schema: Any, direction: Any) -> dict[str, Any]:  # noqa: ANN401 -- schema protocol
        references = {
            kind: auto_schema.resolve_serializer(serializer(), direction).ref
            for kind, serializer in ClosedOutcomeSerializer.kinds.items()
        }
        return {
            "oneOf": list({ref["$ref"]: ref for ref in references.values()}.values()),
            "discriminator": {
                "propertyName": "kind",
                "mapping": {kind: reference["$ref"] for kind, reference in references.items()},
            },
        }


class ResolutionBodySerializer(StrictPayloadSerializer):
    outcomes: serializers.ListSerializer[dict[str, Any]] = serializers.ListSerializer(
        child=ClosedOutcomeSerializer(), allow_empty=False, max_length=MAX_TRANSFER_ITEMS
    )


class CloseDiscrepancySerializer(StrictPayloadSerializer):
    expected_revision = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=1000)
    evidence_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=MAX_TRANSFER_ITEMS
    )
    resolution = ResolutionBodySerializer()


class ManifestLineSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    lot_id = serializers.UUIDField()
    piece_id = serializers.UUIDField(allow_null=True)
    unit_version_id = serializers.UUIDField()
    quantity = serializers.CharField()


class ManifestEvidenceSerializer(serializers.Serializer[Any]):
    upload_id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=["signature", "photo"])
    sha256 = serializers.CharField()
    coverage = serializers.ListField(child=serializers.UUIDField())


class ExtraObservationSerializer(serializers.Serializer[Any]):
    kind = serializers.ChoiceField(choices=["identified_extra", "unidentified_extra"])
    scan_id = serializers.UUIDField(required=False)
    lot_id = serializers.UUIDField(required=False)
    piece_id = serializers.UUIDField(required=False, allow_null=True)
    unit_version_id = serializers.UUIDField(required=False)
    unidentified_code = serializers.CharField(required=False)
    quantity = serializers.CharField()


class TransferObservedPinSerializer(serializers.Serializer[Any]):
    line_id = serializers.UUIDField()
    lot_version_id = serializers.UUIDField()
    supply_version_id = serializers.UUIDField()
    protocol_id = serializers.UUIDField(allow_null=True)
    origin_version_id = serializers.UUIDField()
    destination_version_id = serializers.UUIDField()
    available_at_observation = serializers.CharField()


class TransferObservedFactsSerializer(serializers.Serializer[Any]):
    version = serializers.IntegerField()
    available = serializers.BooleanField()
    transfer_id = serializers.UUIDField()
    prepared_hash = serializers.CharField()
    identity_hash = serializers.CharField()
    pins = TransferObservedPinSerializer(many=True)
    observed_at = serializers.DateTimeField()


class TransferManifestSerializer(serializers.Serializer[Any]):
    lines = ManifestLineSerializer(many=True, required=False)
    evidence = ManifestEvidenceSerializer(many=True)
    dispatch_event_id = serializers.UUIDField(required=False)
    scanned = ClosedScanSerializer(many=True, required=False)
    received = serializers.DictField(child=serializers.CharField(), required=False)
    missing = MissingAssertionSerializer(many=True, required=False)
    extras = ExtraObservationSerializer(many=True, required=False)
    duplicates = serializers.ListField(child=serializers.UUIDField(), required=False)
    discrepancy_id = serializers.UUIDField(required=False)
    reason = serializers.CharField(required=False)
    outcomes = ClosedOutcomeSerializer(many=True, required=False)
    source_facts = TransferObservedFactsSerializer(required=False)


@extend_schema_field(TransferManifestSerializer)
class SignedManifestField(serializers.JSONField):
    """Return exact canonical JSON bytes/values; DRF Decimal conversion must not alter its hash."""


class TransferEventSerializer(OrgScopedModelSerializer):
    manifest = SignedManifestField(read_only=True)
    operation_id = serializers.SerializerMethodField()
    discrepancy_id = serializers.SerializerMethodField()

    class Meta:
        model = TransferEvent
        fields = [
            "id",
            "transfer_id",
            "revision",
            "kind",
            "command_id",
            "manifest",
            "manifest_hash",
            "device_time",
            "server_received_at",
            "declared_source_uuid",
            "operation_id",
            "discrepancy_id",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_operation_id(self, event: TransferEvent) -> str | None:
        operation = getattr(event, "stock_operation", None)
        return str(operation.pk) if operation is not None else None

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_discrepancy_id(self, event: TransferEvent) -> str | None:
        if event.kind == "resolution":
            return str(event.resolution.discrepancy_id)
        discrepancy = getattr(event, "discrepancy", None)
        return str(discrepancy.pk) if discrepancy else None


class TransferLineSerializer(OrgScopedModelSerializer):
    lot_code = serializers.CharField(source="lot.code", read_only=True)

    class Meta:
        model = TransferLine
        fields = [
            "id",
            "lot_id",
            "lot_code",
            "piece_id",
            "unit_version_id",
            "quantity",
            "origin_version_id",
            "destination_version_id",
        ]
        read_only_fields = fields


class TransferSerializer(OrgScopedModelSerializer):
    lines = TransferLineSerializer(many=True, read_only=True)
    events = TransferEventSerializer(many=True, read_only=True)
    revision = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()
    outstanding = serializers.SerializerMethodField()

    class Meta:
        model = Transfer
        fields = [
            "id",
            "code",
            "origin_id",
            "destination_id",
            "lines",
            "events",
            "revision",
            "state",
            "outstanding",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields

    def get_revision(self, transfer: Transfer) -> int:
        return max((event.revision for event in transfer.events.all()), default=0)

    @extend_schema_field(
        {
            "type": "string",
            "enum": ["prepared", "dispatched", "received", "discrepancy", "resolved"],
        }
    )
    def get_state(self, transfer: Transfer) -> str:
        from inventory.transfers.selectors import transfer_state

        return str(getattr(transfer, "current_state", None) or transfer_state(transfer))

    @extend_schema_field(serializers.DictField(child=serializers.CharField()))
    def get_outstanding(self, transfer: Transfer) -> dict[str, str]:
        from inventory.transfers.selectors import outstanding_custody

        return outstanding_custody(transfer)


class DiscrepancyLineSerializer(OrgScopedModelSerializer):
    class Meta:
        model = DiscrepancyLine
        fields = ["id", "kind", "line_id", "quantity", "observation"]
        read_only_fields = fields


class TransferHoldSerializer(OrgScopedModelSerializer):
    resolution_id = serializers.UUIDField(
        source="resolution.resolution_id", read_only=True, allow_null=True
    )

    lot_code = serializers.CharField(source="lot.code", read_only=True)

    class Meta:
        model = TransferHold
        fields = ["id", "lot_id", "lot_code", "location_id", "piece_id", "resolution_id"]
        read_only_fields = fields


class DiscrepancySerializer(OrgScopedModelSerializer):
    transfer = TransferSerializer(read_only=True)
    lines = DiscrepancyLineSerializer(many=True, read_only=True)
    holds = TransferHoldSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()
    revision = serializers.SerializerMethodField()
    resolution = serializers.SerializerMethodField()

    class Meta:
        model = Discrepancy
        fields = [
            "id",
            "code",
            "transfer_id",
            "transfer",
            "receipt_event_id",
            "lines",
            "holds",
            "status",
            "revision",
            "resolution",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields

    def get_revision(self, discrepancy: Discrepancy) -> int:
        return 1 if hasattr(discrepancy, "resolution") else 0

    @extend_schema_field({"type": "string", "enum": ["open", "closed"]})
    def get_status(self, discrepancy: Discrepancy) -> str:
        return "closed" if hasattr(discrepancy, "resolution") else "open"

    @extend_schema_field(TransferEventSerializer(allow_null=True))
    def get_resolution(self, discrepancy: Discrepancy) -> dict[str, Any] | None:
        resolution = getattr(discrepancy, "resolution", None)
        return dict(TransferEventSerializer(resolution.event).data) if resolution else None


class TransferQuerySerializer(serializers.Serializer[Any]):
    origin = serializers.UUIDField(required=False)
    destination = serializers.UUIDField(required=False)
    lot = serializers.UUIDField(required=False)
    transfer = serializers.UUIDField(required=False)
    state = serializers.ChoiceField(
        choices=["prepared", "dispatched", "received", "discrepancy", "resolved"], required=False
    )
    status = serializers.ChoiceField(choices=["open", "closed"], required=False)
    created_at_from = serializers.DateTimeField(required=False)
    created_at_before = serializers.DateTimeField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start, end = attrs.get("created_at_from"), attrs.get("created_at_before")
        if start is not None and end is not None and end <= start:
            raise serializers.ValidationError({"created_at_before": "Invalid range."})
        return attrs
