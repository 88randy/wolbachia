"""Insert-only signed custody identities, accountable receipts and bounded stock effects."""

from django.db import models

from inventory.models import QUANTITY_DIGITS, QUANTITY_PLACES, InventoryRecord


class Transfer(InventoryRecord):
    code = models.CharField(max_length=50)
    origin = models.ForeignKey(
        "inventory.Location", on_delete=models.PROTECT, related_name="outbound_transfers"
    )
    destination = models.ForeignKey(
        "inventory.Location", on_delete=models.PROTECT, related_name="inbound_transfers"
    )
    content_hash = models.CharField(max_length=64)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="transfer_org_code"),
            models.CheckConstraint(
                condition=~models.Q(origin=models.F("destination")), name="transfer_distinct_stores"
            ),
        ]


class TransferLine(InventoryRecord):
    transfer = models.ForeignKey(Transfer, on_delete=models.PROTECT, related_name="lines")
    lot = models.ForeignKey(
        "inventory.Lot", on_delete=models.PROTECT, related_name="transfer_lines"
    )
    piece = models.ForeignKey(
        "inventory.Piece", null=True, on_delete=models.PROTECT, related_name="+"
    )
    unit_version = models.ForeignKey(
        "inventory.SupplyTypeVersion", on_delete=models.PROTECT, related_name="+"
    )
    origin_version = models.ForeignKey(
        "inventory.LocationVersion", on_delete=models.PROTECT, related_name="+"
    )
    destination_version = models.ForeignKey(
        "inventory.LocationVersion", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="transfer_line_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(piece__isnull=True) | models.Q(quantity=1),
                name="transfer_piece_one",
            ),
            models.UniqueConstraint(
                fields=["transfer", "lot", "piece", "unit_version"],
                nulls_distinct=False,
                name="transfer_line_identity",
            ),
        ]


class TransferEvent(InventoryRecord):
    transfer = models.ForeignKey(Transfer, on_delete=models.PROTECT, related_name="events")
    revision = models.PositiveIntegerField()
    kind = models.CharField(
        max_length=12,
        choices=[(kind, kind) for kind in ("prepared", "dispatch", "receive", "resolution")],
    )
    manifest = models.JSONField()
    manifest_hash = models.CharField(max_length=64)
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    declared_source_uuid = models.UUIDField(null=True)
    source_payload_hash = models.CharField(max_length=64, blank=True)
    command_id = models.UUIDField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["transfer", "revision"], name="transfer_event_revision"
            ),
            models.UniqueConstraint(
                fields=["transfer", "kind"],
                condition=models.Q(kind__in=["prepared", "dispatch", "receive"]),
                name="transfer_terminal_phase",
            ),
            models.UniqueConstraint(
                fields=["organization", "declared_source_uuid"],
                condition=models.Q(declared_source_uuid__isnull=False),
                name="transfer_declared_source_once",
            ),
        ]


class TransferSourceLink(InventoryRecord):
    event = models.OneToOneField(
        TransferEvent, on_delete=models.PROTECT, related_name="source_link"
    )
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="transfer_source_link"
    )


class TransferVoidAudit(InventoryRecord):
    target_event = models.OneToOneField(
        TransferEvent, on_delete=models.PROTECT, related_name="void_audit"
    )
    void_source_uuid = models.UUIDField(unique=True)
    void_payload_hash = models.CharField(max_length=64)
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    compensation_event_ids = models.JSONField(default=list)


class TransferCommandReceipt(InventoryRecord):
    command_id = models.UUIDField()
    kind = models.CharField(max_length=12)
    transfer = models.ForeignKey(
        Transfer, on_delete=models.PROTECT, related_name="command_receipts"
    )
    event = models.OneToOneField(
        TransferEvent, on_delete=models.PROTECT, related_name="command_receipt"
    )
    expected_revision = models.PositiveIntegerField()
    content_hash = models.CharField(max_length=64)
    original_actor_id = models.UUIDField()
    declared_source_uuid = models.UUIDField(null=True)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="transfer_command_identity"
            )
        ]


class TransferReceiptLine(InventoryRecord):
    event = models.ForeignKey(TransferEvent, on_delete=models.PROTECT, related_name="receipt_lines")
    line = models.ForeignKey(TransferLine, on_delete=models.PROTECT, related_name="receipts")
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["event", "line"], name="transfer_receipt_line"),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="transfer_received_positive"
            ),
        ]


class Discrepancy(InventoryRecord):
    code = models.CharField(max_length=50)
    transfer = models.ForeignKey(Transfer, on_delete=models.PROTECT, related_name="discrepancies")
    receipt_event = models.OneToOneField(
        TransferEvent, on_delete=models.PROTECT, related_name="discrepancy"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="discrepancy_org_code")
        ]


class DiscrepancyLine(InventoryRecord):
    discrepancy = models.ForeignKey(Discrepancy, on_delete=models.PROTECT, related_name="lines")
    kind = models.CharField(
        max_length=20,
        choices=[(kind, kind) for kind in ("missing", "identified_extra", "unidentified_extra")],
    )
    line = models.ForeignKey(
        TransferLine, null=True, on_delete=models.PROTECT, related_name="discrepancy_lines"
    )
    observation = models.JSONField(default=dict)
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="discrepancy_line_positive"
            )
        ]


class DiscrepancyResolution(InventoryRecord):
    discrepancy = models.OneToOneField(
        Discrepancy, on_delete=models.PROTECT, related_name="resolution"
    )
    event = models.OneToOneField(TransferEvent, on_delete=models.PROTECT, related_name="resolution")
    expected_revision = models.PositiveIntegerField()
    content_hash = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    evidence_ids = models.JSONField(default=list)


class ResolutionOutcome(InventoryRecord):
    resolution = models.ForeignKey(
        DiscrepancyResolution, on_delete=models.PROTECT, related_name="outcomes"
    )
    line = models.ForeignKey(DiscrepancyLine, on_delete=models.PROTECT, related_name="outcomes")
    kind = models.CharField(
        max_length=27,
        choices=[
            (kind, kind)
            for kind in (
                "ack_missing",
                "recover_dest",
                "return_origin",
                "reference_signed_correction",
            )
        ],
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    proof = models.JSONField(default=dict)
    dispatch_event = models.ForeignKey(
        TransferEvent, null=True, on_delete=models.PROTECT, related_name="dispatch_outcomes"
    )
    receipt_event = models.ForeignKey(
        TransferEvent, null=True, on_delete=models.PROTECT, related_name="receipt_outcomes"
    )
    signature_upload = models.ForeignKey(
        "uploads.Upload", null=True, on_delete=models.PROTECT, related_name="receiving_outcomes"
    )
    correction_transfer = models.ForeignKey(
        Transfer, null=True, on_delete=models.PROTECT, related_name="correction_outcomes"
    )
    correction_receipt_line = models.ForeignKey(
        TransferReceiptLine, null=True, on_delete=models.PROTECT, related_name="allocated_outcomes"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["resolution", "line", "kind"], name="transfer_outcome_identity"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="transfer_outcome_positive"
            ),
        ]


class TransferHold(InventoryRecord):
    discrepancy = models.ForeignKey(Discrepancy, on_delete=models.PROTECT, related_name="holds")
    lot = models.ForeignKey(
        "inventory.Lot", on_delete=models.PROTECT, related_name="transfer_holds"
    )
    location = models.ForeignKey(
        "inventory.Location", on_delete=models.PROTECT, related_name="transfer_holds"
    )
    piece = models.ForeignKey(
        "inventory.Piece", null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["discrepancy", "lot", "location", "piece"],
                nulls_distinct=False,
                name="transfer_owned_hold",
            )
        ]


class TransferHoldResolution(InventoryRecord):
    hold = models.OneToOneField(TransferHold, on_delete=models.PROTECT, related_name="resolution")
    resolution = models.ForeignKey(
        DiscrepancyResolution, on_delete=models.PROTECT, related_name="hold_resolutions"
    )


class TransferStockEffect(InventoryRecord):
    transfer = models.ForeignKey(Transfer, on_delete=models.PROTECT, related_name="stock_effects")
    event = models.ForeignKey(TransferEvent, on_delete=models.PROTECT, related_name="stock_effects")
    line = models.ForeignKey(TransferLine, on_delete=models.PROTECT, related_name="stock_effects")
    kind = models.CharField(max_length=16)
    movement = models.OneToOneField(
        "inventory.StockMovement", on_delete=models.PROTECT, related_name="transfer_effect"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["transfer", "line", "kind"], name="transfer_stock_effect_once"
            )
        ]


class TransferEvidenceReference(InventoryRecord):
    event = models.ForeignKey(TransferEvent, on_delete=models.PROTECT, related_name="evidence_refs")
    upload = models.ForeignKey(
        "uploads.Upload", on_delete=models.PROTECT, related_name="transfer_refs"
    )
    role = models.CharField(max_length=10, choices=[("signature", "signature"), ("photo", "photo")])
    coverage = models.JSONField(default=list)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["event", "upload"], name="transfer_evidence_identity")
        ]
