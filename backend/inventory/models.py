"""Immutable inventory identity, revision, custody and measurement facts."""

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel

QUANTITY_DIGITS = 20
QUANTITY_PLACES = 6


class InventoryRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True


class SupplyType(InventoryRecord):
    code = models.CharField(max_length=50)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="supply_org_code")
        ]


class SupplyTypeVersion(InventoryRecord):
    supply_type = models.ForeignKey(SupplyType, on_delete=models.PROTECT, related_name="versions")
    revision = models.PositiveIntegerField()
    label = models.CharField(max_length=200)
    unit = models.CharField(max_length=24)
    identity_kind = models.CharField(max_length=5, choices=[("piece", "piece"), ("lot", "lot")])
    is_biological = models.BooleanField()
    is_chemical = models.BooleanField(null=True)
    requires_insecticide_free = models.BooleanField(null=True)
    expiry_required = models.BooleanField(null=True)
    specification = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["supply_type", "revision"], name="supply_revision")
        ]


class BiologicalProtocolVersion(InventoryRecord):
    supply_version = models.OneToOneField(
        SupplyTypeVersion, on_delete=models.PROTECT, related_name="protocol"
    )
    name = models.CharField(max_length=200, blank=True)
    shelf_life_seconds = models.PositiveBigIntegerField(null=True)
    expiry_basis = models.CharField(max_length=20, blank=True)
    temperature_min = models.DecimalField(max_digits=12, decimal_places=6, null=True)
    temperature_max = models.DecimalField(max_digits=12, decimal_places=6, null=True)
    humidity_min = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    humidity_max = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    reading_windows = models.JSONField(default=list)
    required_fields = models.JSONField(default=list)
    incident_type = models.ForeignKey(
        "incidents.IncidentTypeVersion", null=True, on_delete=models.PROTECT, related_name="+"
    )


class Location(InventoryRecord):
    scope_center_lookup = "center_id"
    scope_quadrant_lookup = "quadrant_id"
    code = models.CharField(max_length=50)
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="location_org_code")
        ]


class LocationVersion(InventoryRecord):
    scope_center_lookup = "location__center_id"
    scope_quadrant_lookup = "location__quadrant_id"
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="versions")
    revision = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    kind = models.CharField(
        max_length=12,
        choices=[("biofactory", "biofactory"), ("warehouse", "warehouse"), ("center", "center")],
    )
    geometry = models.JSONField()
    owner = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    is_insecticide_free = models.BooleanField(null=True)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["location", "revision"], name="location_revision")
        ]


class Lot(InventoryRecord):
    scope_center_lookup = "center_id"
    scope_quadrant_lookup = "quadrant_id"
    code = models.CharField(max_length=50)
    supply = models.ForeignKey(SupplyType, on_delete=models.PROTECT, related_name="lots")
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="lot_org_code")
        ]


class LotVersion(InventoryRecord):
    scope_center_lookup = "lot__center_id"
    scope_quadrant_lookup = "lot__quadrant_id"
    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="versions")
    revision = models.PositiveIntegerField()
    supply_version = models.ForeignKey(
        SupplyTypeVersion, on_delete=models.PROTECT, related_name="+"
    )
    protocol = models.ForeignKey(
        BiologicalProtocolVersion, null=True, on_delete=models.PROTECT, related_name="+"
    )
    initial_location = models.ForeignKey(
        Location, null=True, on_delete=models.PROTECT, related_name="+"
    )
    location_version = models.ForeignKey(
        LocationVersion, null=True, on_delete=models.PROTECT, related_name="+"
    )
    quantity = models.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, null=True
    )
    provenance = models.CharField(max_length=2000, blank=True, default="")
    species = models.CharField(max_length=120, blank=True, default="")
    strain = models.CharField(max_length=120, blank=True, default="")
    generation = models.CharField(max_length=120, blank=True, default="")
    laid_on = models.DateField(null=True)
    estimated_organism_count = models.DecimalField(
        max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES, null=True
    )
    observations = models.TextField(blank=True, default="")
    expires_at = models.DateTimeField(null=True)
    expiry_date = models.DateField(null=True)
    timezone = models.CharField(max_length=64)

    class Meta(InventoryRecord.Meta):
        constraints = [models.UniqueConstraint(fields=["lot", "revision"], name="lot_revision")]


class LotAdmission(InventoryRecord):
    lot = models.OneToOneField(Lot, on_delete=models.PROTECT, related_name="admission")
    lot_version = models.OneToOneField(
        LotVersion, on_delete=models.PROTECT, related_name="admission"
    )
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="admissions")
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0), name="admission_positive_quantity"
            )
        ]


class Piece(InventoryRecord):
    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="pieces")
    admission = models.ForeignKey(LotAdmission, on_delete=models.PROTECT, related_name="pieces")


class StockOperation(InventoryRecord):
    admission = models.OneToOneField(
        LotAdmission, null=True, on_delete=models.PROTECT, related_name="operation"
    )
    transfer_event = models.OneToOneField(
        "inventory.TransferEvent",
        null=True,
        on_delete=models.PROTECT,
        related_name="stock_operation",
    )
    supply_source = models.OneToOneField(
        "inventory.SupplyLedgerSource",
        null=True,
        on_delete=models.PROTECT,
        related_name="stock_operation",
    )
    paddle_return = models.OneToOneField(
        "inventory.PaddleStockReturn",
        null=True,
        on_delete=models.PROTECT,
        related_name="stock_operation",
    )
    source_kind = models.CharField(
        max_length=24,
        choices=[
            (kind, kind)
            for kind in (
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
            )
        ],
    )
    source_id = models.UUIDField()
    content_hash = models.CharField(max_length=64)

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        source_kind="lot_admission",
                        admission__isnull=False,
                        transfer_event__isnull=True,
                        supply_source__isnull=True,
                        paddle_return__isnull=True,
                    )
                    | models.Q(
                        source_kind__in=[
                            "transfer_dispatch",
                            "transfer_receive",
                            "transfer_resolution",
                        ],
                        admission__isnull=True,
                        transfer_event__isnull=False,
                        supply_source__isnull=True,
                        paddle_return__isnull=True,
                    )
                    | models.Q(
                        source_kind__in=[
                            "supply_receive",
                            "supply_reconcile",
                            "supply_return",
                            "lot_write_off",
                            "supply_compensation",
                        ],
                        admission__isnull=True,
                        transfer_event__isnull=True,
                        supply_source__isnull=False,
                        paddle_return__isnull=True,
                    )
                    | models.Q(
                        source_kind="paddle_return",
                        admission__isnull=True,
                        transfer_event__isnull=True,
                        supply_source__isnull=True,
                        paddle_return__isnull=False,
                    )
                ),
                name="stock_exact_source_branch",
            ),
            models.UniqueConstraint(
                fields=["organization", "source_kind", "source_id"], name="stock_operation_source"
            ),
        ]


class StockMovement(InventoryRecord):
    scope_center_lookup = "location__center_id"
    scope_quadrant_lookup = "location__quadrant_id"
    operation = models.ForeignKey(
        StockOperation, on_delete=models.PROTECT, related_name="movements"
    )
    line_number = models.PositiveIntegerField()
    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="movements")
    location = models.ForeignKey(
        Location, null=True, on_delete=models.PROTECT, related_name="movements"
    )
    assignment = models.ForeignKey(
        "inventory.SupplyAssignment", null=True, on_delete=models.PROTECT, related_name="movements"
    )
    piece = models.ForeignKey(Piece, null=True, on_delete=models.PROTECT, related_name="movements")
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    unit_version = models.ForeignKey(SupplyTypeVersion, on_delete=models.PROTECT, related_name="+")

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(location__isnull=False, assignment__isnull=True)
                    | models.Q(location__isnull=True, assignment__isnull=False)
                ),
                name="stock_exact_custodian",
            ),
            models.UniqueConstraint(
                fields=["operation", "line_number"], name="stock_operation_leg"
            ),
            models.CheckConstraint(condition=~models.Q(quantity=0), name="stock_quantity_nonzero"),
        ]


class ConditionReading(InventoryRecord):
    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="condition_readings")
    lot_version = models.ForeignKey(LotVersion, on_delete=models.PROTECT, related_name="+")
    protocol = models.ForeignKey(
        BiologicalProtocolVersion, null=True, on_delete=models.PROTECT, related_name="+"
    )
    location_version = models.ForeignKey(
        LocationVersion, null=True, on_delete=models.PROTECT, related_name="+"
    )
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    temperature_c = models.DecimalField(max_digits=12, decimal_places=6)
    humidity_pct = models.DecimalField(max_digits=9, decimal_places=6)
    local_date = models.DateField()
    slot = models.PositiveSmallIntegerField(null=True)
    timezone = models.CharField(max_length=64)
    evaluation = models.CharField(
        max_length=10,
        choices=[("normal", "normal"), ("breach", "breach"), ("unassessed", "unassessed")],
    )
    content_hash = models.CharField(max_length=64)
    capture_mode = models.CharField(
        max_length=17,
        default="legacy_initial",
        choices=[("legacy_initial", "legacy_initial"), ("explicit_location", "explicit_location")],
    )
    capture_location = models.ForeignKey(
        Location, null=True, on_delete=models.PROTECT, related_name="condition_readings"
    )

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "lot", "device_time"],
                condition=models.Q(capture_mode="legacy_initial"),
                name="condition_capture_identity",
            ),
            models.UniqueConstraint(
                fields=["organization", "lot", "capture_location", "device_time"],
                condition=models.Q(capture_mode="explicit_location"),
                name="condition_explicit_identity",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(capture_mode="legacy_initial", capture_location__isnull=True)
                    | models.Q(
                        capture_mode="explicit_location",
                        capture_location__isnull=False,
                        location_version__isnull=False,
                    )
                ),
                name="condition_location_mode",
            ),
            models.CheckConstraint(
                condition=models.Q(slot__isnull=True) | models.Q(slot__in=[0, 1]),
                name="condition_slot_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(humidity_pct__gte=0, humidity_pct__lte=100),
                name="condition_humidity_unit",
            ),
        ]


class ConditionBreach(InventoryRecord):
    reading = models.OneToOneField(
        ConditionReading, on_delete=models.PROTECT, related_name="breach"
    )


class ConditionIncidentLink(InventoryRecord):
    breach = models.OneToOneField(
        ConditionBreach, on_delete=models.PROTECT, related_name="incident_link"
    )
    incident = models.OneToOneField(
        "incidents.Incident", on_delete=models.PROTECT, related_name="condition_link"
    )
    actor_kind = models.CharField(max_length=6, default="system", editable=False)
    policy_version = models.CharField(max_length=40, default="inventory.v1")

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(actor_kind="system", created_by__isnull=True),
                name="condition_link_system_author",
            )
        ]


class PaddleStockReturn(InventoryRecord):
    reuse = models.OneToOneField(
        "lab.PaddleReuse", on_delete=models.PROTECT, related_name="stock_return"
    )
    source_movement = models.ForeignKey(
        StockMovement, on_delete=models.PROTECT, related_name="paddle_returns"
    )
    consumed_debit = models.OneToOneField(
        StockMovement, null=True, on_delete=models.PROTECT, related_name="paddle_recovery"
    )
    piece = models.ForeignKey(Piece, on_delete=models.PROTECT, related_name="paddle_returns")
    lot = models.ForeignKey(Lot, on_delete=models.PROTECT, related_name="paddle_returns")
    unit_version = models.ForeignKey(SupplyTypeVersion, on_delete=models.PROTECT, related_name="+")
    source_location = models.ForeignKey(
        Location, null=True, on_delete=models.PROTECT, related_name="paddle_returns_out"
    )
    destination = models.ForeignKey(
        Location, on_delete=models.PROTECT, related_name="paddle_returns_in"
    )
    kind = models.CharField(
        max_length=9, choices=[("custody", "custody"), ("consumed", "consumed")]
    )
    content_hash = models.CharField(max_length=64)
    source_proof = models.JSONField()

    class Meta(InventoryRecord.Meta):
        constraints = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False), name="paddle_return_author"
            ),
            models.UniqueConstraint(
                fields=["source_movement"],
                condition=models.Q(kind="custody"),
                name="paddle_custody_receipt_once",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    kind="custody", source_location__isnull=False, consumed_debit__isnull=True
                )
                | models.Q(
                    kind="consumed", source_location__isnull=True, consumed_debit__isnull=False
                ),
                name="paddle_return_exact_source",
            ),
        ]


# Register nested inventory models only after their shared immutable base is defined.
from inventory.allocations import models as allocation_models  # noqa: E402,F401
from inventory.transfers import models as transfer_models  # noqa: E402,F401
