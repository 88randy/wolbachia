"""Immutable actual custody, configuration, command and disposal facts for B10."""

from django.db import models

from inventory.allocations.permissions import INTENT_KINDS
from inventory.models import QUANTITY_DIGITS, QUANTITY_PLACES, InventoryRecord


class CourierTransitPolicyVersion(InventoryRecord):
    supply_version = models.ForeignKey("inventory.SupplyTypeVersion", on_delete=models.PROTECT)
    revision = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    procedure = models.TextField()
    reference = models.TextField()
    mode = models.CharField(max_length=24, choices=[("manual_evidence_review",) * 2])
    proof_roles = models.JSONField()
    is_active = models.BooleanField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["supply_version", "revision"], name="b10_transit_revision"
            )
        ]
        ordering = ["-revision"]


class SupplyMaterialMappingVersion(InventoryRecord):
    supply_version = models.ForeignKey("inventory.SupplyTypeVersion", on_delete=models.PROTECT)
    revision = models.PositiveIntegerField()
    action = models.CharField(max_length=5, choices=[("place", "place"), ("check", "check")])
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    reference = models.TextField()
    is_active = models.BooleanField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["supply_version", "action", "revision"], name="b10_mapping_revision"
            ),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="b10_mapping_positive"),
        ]
        ordering = ["-revision"]


class SupplyAssignment(InventoryRecord):
    courier = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    origin = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="+")
    date = models.DateField()
    shift = models.ForeignKey("shifts.Shift", null=True, on_delete=models.PROTECT, related_name="+")


class SupplyAssignmentVersion(InventoryRecord):
    assignment = models.ForeignKey(
        SupplyAssignment, on_delete=models.PROTECT, related_name="versions"
    )
    revision = models.PositiveIntegerField()
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="next"
    )
    planning_proof = models.JSONField(default=dict)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["assignment", "revision"], name="b10_plan_revision")
        ]
        ordering = ["-revision"]


class SupplyAssignmentLine(InventoryRecord):
    version = models.ForeignKey(
        SupplyAssignmentVersion, on_delete=models.PROTECT, related_name="lines"
    )
    lot = models.ForeignKey("inventory.Lot", on_delete=models.PROTECT, related_name="+")
    piece = models.ForeignKey(
        "inventory.Piece", null=True, on_delete=models.PROTECT, related_name="+"
    )
    unit_version = models.ForeignKey(
        "inventory.SupplyTypeVersion", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="b10_plan_positive")
        ]


class SupplyAssignmentCommandReceipt(InventoryRecord):
    version = models.OneToOneField(SupplyAssignmentVersion, on_delete=models.PROTECT)
    command_id = models.UUIDField()
    input_hash = models.CharField(max_length=64)
    response = models.JSONField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "command_id"], name="b10_plan_command")
        ]


class Reconciliation(InventoryRecord):
    assignment = models.OneToOneField(
        SupplyAssignment, on_delete=models.PROTECT, related_name="reconciliation"
    )


class InventoryIntent(InventoryRecord):
    command_id = models.UUIDField()
    kind = models.CharField(max_length=24, choices=[(kind, kind) for kind in INTENT_KINDS])
    assignment = models.ForeignKey(
        SupplyAssignment, null=True, on_delete=models.PROTECT, related_name="+"
    )
    release = models.ForeignKey(
        "inventory.OriginReleaseProof", null=True, on_delete=models.PROTECT, related_name="+"
    )
    reconciliation = models.ForeignKey(
        Reconciliation, null=True, on_delete=models.PROTECT, related_name="+"
    )
    declaration = models.ForeignKey(
        "inventory.ReturnDeclaration", null=True, on_delete=models.PROTECT, related_name="+"
    )
    lot = models.ForeignKey("inventory.Lot", null=True, on_delete=models.PROTECT, related_name="+")
    location = models.ForeignKey(
        "inventory.Location", null=True, on_delete=models.PROTECT, related_name="+"
    )
    piece = models.ForeignKey(
        "inventory.Piece", null=True, on_delete=models.PROTECT, related_name="+"
    )
    unit_version = models.ForeignKey(
        "inventory.SupplyTypeVersion", null=True, on_delete=models.PROTECT, related_name="+"
    )
    bag = models.ForeignKey("ovitraps.Bag", null=True, on_delete=models.PROTECT, related_name="+")
    expected_revision = models.PositiveIntegerField()
    canonical_input = models.JSONField()
    input_hash = models.CharField(max_length=64)
    declared_evidence = models.JSONField()
    prepared_response = models.JSONField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="b10_intent_command"
            )
        ]


class InventoryIntentExecution(InventoryRecord):
    intent = models.OneToOneField(
        InventoryIntent, on_delete=models.PROTECT, related_name="execution"
    )
    response_status = models.PositiveSmallIntegerField()
    response = models.JSONField()
    written_revision = models.PositiveIntegerField()


class OriginReleaseProof(InventoryRecord):
    version = models.ForeignKey(
        SupplyAssignmentVersion, on_delete=models.PROTECT, related_name="releases"
    )
    intent = models.OneToOneField(
        InventoryIntent, on_delete=models.PROTECT, related_name="release_effect"
    )
    proof = models.JSONField()
    manifest_hash = models.CharField(max_length=64)


class OriginReleaseLine(InventoryRecord):
    release = models.ForeignKey(OriginReleaseProof, on_delete=models.PROTECT, related_name="lines")
    line = models.ForeignKey(
        SupplyAssignmentLine, on_delete=models.PROTECT, related_name="releases"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    safety_proof = models.JSONField()
    transit_policy = models.ForeignKey(
        CourierTransitPolicyVersion, null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["release", "line"], name="b10_release_line"),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="b10_release_positive"),
        ]


class ReleaseCancellation(InventoryRecord):
    release = models.ForeignKey(
        OriginReleaseProof, on_delete=models.PROTECT, related_name="cancellations"
    )
    intent = models.OneToOneField(
        InventoryIntent, on_delete=models.PROTECT, related_name="cancellation_effect"
    )
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)


class ReleaseCancellationLine(InventoryRecord):
    cancellation = models.ForeignKey(
        ReleaseCancellation, on_delete=models.PROTECT, related_name="lines"
    )
    release_line = models.ForeignKey(
        OriginReleaseLine, on_delete=models.PROTECT, related_name="cancellations"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["cancellation", "release_line"], name="b10_cancel_line"
            ),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="b10_cancel_positive"),
        ]


class SupplyEvent(InventoryRecord):
    assignment = models.ForeignKey(
        SupplyAssignment, on_delete=models.PROTECT, related_name="events"
    )
    revision = models.PositiveIntegerField()
    kind = models.CharField(
        max_length=9, choices=[("receive", "receive"), ("reconcile", "reconcile")]
    )
    command_id = models.UUIDField()
    expected_revision = models.PositiveIntegerField()
    canonical_input = models.JSONField()
    input_hash = models.CharField(max_length=64)
    declared_source_uuid = models.UUIDField()
    source_payload_hash = models.CharField(max_length=64)
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    original_proof = models.JSONField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["assignment", "revision"], name="b10_event_revision"),
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="b10_event_command"
            ),
            models.UniqueConstraint(
                fields=["organization", "declared_source_uuid"], name="b10_source_once"
            ),
        ]
        ordering = ["-revision"]


class SupplySourceLink(InventoryRecord):
    event = models.OneToOneField(SupplyEvent, on_delete=models.PROTECT, related_name="source_link")
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="supply_source_link"
    )


class SupplySourceResult(InventoryRecord):
    event = models.OneToOneField(SupplyEvent, on_delete=models.PROTECT, related_name="result")
    response = models.JSONField()


class SupplyReceipt(InventoryRecord):
    event = models.OneToOneField(SupplyEvent, on_delete=models.PROTECT, related_name="receipt")
    release = models.ForeignKey(
        OriginReleaseProof, on_delete=models.PROTECT, related_name="receipts"
    )
    signature = models.ForeignKey(
        "uploads.Upload", null=True, on_delete=models.PROTECT, related_name="+"
    )
    observations = models.JSONField()


class SupplyReceiptLine(InventoryRecord):
    receipt = models.ForeignKey(SupplyReceipt, on_delete=models.PROTECT, related_name="lines")
    release_line = models.ForeignKey(
        OriginReleaseLine, on_delete=models.PROTECT, related_name="receipts"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["receipt", "release_line"], name="b10_receipt_line"),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=0), name="b10_actual_zero_valid"
            ),
        ]


class SupplyUse(InventoryRecord):
    event = models.ForeignKey(SupplyEvent, on_delete=models.PROTECT, related_name="uses")
    receipt_line = models.ForeignKey(
        SupplyReceiptLine, on_delete=models.PROTECT, related_name="uses"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    work_kind = models.CharField(
        max_length=11, choices=[("field_event", "field_event"), ("manual", "manual")]
    )
    work_source = models.ForeignKey(
        "field_sync.FieldEvent", null=True, on_delete=models.PROTECT, related_name="+"
    )
    work_point = models.ForeignKey(
        "geography.SamplingPoint", null=True, on_delete=models.PROTECT, related_name="+"
    )
    manual_reason = models.CharField(max_length=1000, blank=True)
    transit_policy = models.ForeignKey(
        CourierTransitPolicyVersion, on_delete=models.PROTECT, related_name="+"
    )
    transit_proof = models.JSONField()


class SupplyShrinkage(InventoryRecord):
    event = models.ForeignKey(SupplyEvent, on_delete=models.PROTECT, related_name="shrinkages")
    receipt_line = models.ForeignKey(
        SupplyReceiptLine, on_delete=models.PROTECT, related_name="shrinkages"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    evidence_ids = models.JSONField()


class ReturnDeclaration(InventoryRecord):
    event = models.ForeignKey(SupplyEvent, on_delete=models.PROTECT, related_name="returns")
    receipt_line = models.ForeignKey(
        SupplyReceiptLine, on_delete=models.PROTECT, related_name="return_declarations"
    )
    destination = models.ForeignKey(
        "inventory.Location", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)


class ReturnAcceptance(InventoryRecord):
    declaration = models.ForeignKey(
        ReturnDeclaration, on_delete=models.PROTECT, related_name="acceptances"
    )
    execution = models.OneToOneField(
        InventoryIntentExecution, on_delete=models.PROTECT, related_name="return_effect"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    signature = models.ForeignKey("uploads.Upload", on_delete=models.PROTECT, related_name="+")


class ReconciliationVersion(InventoryRecord):
    reconciliation = models.ForeignKey(
        Reconciliation, on_delete=models.PROTECT, related_name="versions"
    )
    revision = models.PositiveIntegerField()
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="next"
    )
    source_event = models.ForeignKey(
        SupplyEvent, null=True, on_delete=models.PROTECT, related_name="+"
    )
    acceptance = models.OneToOneField(
        ReturnAcceptance, null=True, on_delete=models.PROTECT, related_name="reconciliation_version"
    )
    shift = models.ForeignKey("shifts.Shift", null=True, on_delete=models.PROTECT, related_name="+")
    close_source_uuid = models.UUIDField(null=True)
    void_audit = models.OneToOneField(
        "inventory.SupplyVoidAudit",
        null=True,
        on_delete=models.PROTECT,
        related_name="reconciliation_version",
    )
    frame = models.JSONField()
    frame_hash = models.CharField(max_length=64)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["reconciliation", "revision"], name="b10_frame_revision"
            )
        ]
        ordering = ["-revision"]


class ReconciliationLine(InventoryRecord):
    version = models.ForeignKey(
        ReconciliationVersion, on_delete=models.PROTECT, related_name="lines"
    )
    assignment_line = models.ForeignKey(
        SupplyAssignmentLine, on_delete=models.PROTECT, related_name="+"
    )
    planned = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    credited = models.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, null=True
    )
    used = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    returned = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    shrinkage = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    difference = models.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, null=True
    )
    delivery_variance = models.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, null=True
    )


class SupplyDiscrepancy(InventoryRecord):
    reconciliation = models.OneToOneField(
        Reconciliation, on_delete=models.PROTECT, related_name="discrepancy"
    )
    frame = models.OneToOneField(
        ReconciliationVersion, on_delete=models.PROTECT, related_name="discrepancy"
    )
    reasons = models.JSONField()


class SupplyDiscrepancyDecision(InventoryRecord):
    discrepancy = models.ForeignKey(
        SupplyDiscrepancy, on_delete=models.PROTECT, related_name="decisions"
    )
    execution = models.OneToOneField(InventoryIntentExecution, on_delete=models.PROTECT)
    frame = models.ForeignKey(
        ReconciliationVersion, on_delete=models.PROTECT, related_name="justifications"
    )
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    evidence_ids = models.JSONField()


class LotWriteOff(InventoryRecord):
    execution = models.OneToOneField(
        InventoryIntentExecution, on_delete=models.PROTECT, related_name="lot_effect"
    )
    lot = models.ForeignKey("inventory.Lot", on_delete=models.PROTECT, related_name="+")
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="+")
    piece = models.ForeignKey(
        "inventory.Piece", null=True, on_delete=models.PROTECT, related_name="+"
    )
    unit_version = models.ForeignKey(
        "inventory.SupplyTypeVersion", on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    owner = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    date = models.DateField()
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    rpbi = models.ForeignKey(
        "uploads.Upload", null=True, on_delete=models.PROTECT, related_name="+"
    )


class BagDisposition(InventoryRecord):
    execution = models.OneToOneField(
        InventoryIntentExecution, on_delete=models.PROTECT, related_name="bag_effect"
    )
    bag = models.OneToOneField("ovitraps.Bag", on_delete=models.PROTECT, related_name="disposition")
    reading = models.ForeignKey(
        "ovitraps.OvitrapReading", on_delete=models.PROTECT, related_name="+"
    )
    source_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )
    owner = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    date = models.DateField()
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    rpbi = models.ForeignKey("uploads.Upload", on_delete=models.PROTECT, related_name="+")
    dependency_proof = models.JSONField()


class SupplyVoidAudit(InventoryRecord):
    event = models.OneToOneField(SupplyEvent, on_delete=models.PROTECT, related_name="void_audit")
    declared_source_uuid = models.UUIDField(unique=True)
    source_payload_hash = models.CharField(max_length=64)
    reason_code = models.CharField(max_length=64)
    reason = models.CharField(max_length=1000)
    compensation_proof = models.JSONField()


class SupplyVoidSourceLink(InventoryRecord):
    audit = models.OneToOneField(
        SupplyVoidAudit, on_delete=models.PROTECT, related_name="source_link"
    )
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="supply_void_source_link"
    )


class SupplyLedgerSource(InventoryRecord):
    kind = models.CharField(max_length=24)
    event = models.OneToOneField(
        SupplyEvent, null=True, on_delete=models.PROTECT, related_name="ledger_source"
    )
    execution = models.OneToOneField(
        InventoryIntentExecution, null=True, on_delete=models.PROTECT, related_name="ledger_source"
    )
    compensation = models.OneToOneField(
        SupplyVoidAudit, null=True, on_delete=models.PROTECT, related_name="ledger_source"
    )
    content_hash = models.CharField(max_length=64)


class SupplyStockEffect(InventoryRecord):
    source = models.ForeignKey(SupplyLedgerSource, on_delete=models.PROTECT, related_name="effects")
    movement = models.OneToOneField(
        "inventory.StockMovement", on_delete=models.PROTECT, related_name="supply_effect"
    )
    assignment_line = models.ForeignKey(
        SupplyAssignmentLine, null=True, on_delete=models.PROTECT, related_name="+"
    )
    receipt_line = models.ForeignKey(
        SupplyReceiptLine, null=True, on_delete=models.PROTECT, related_name="+"
    )
    kind = models.CharField(max_length=16)
