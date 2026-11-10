"""Immutable regulatory authority, equipment lineage and release provenance."""

from typing import ClassVar

from django.db import models
from django.db.models import Q

from core.models import ImmutableMixin, OrgScopedModel
from inventory.models import QUANTITY_DIGITS, QUANTITY_PLACES


class ReleaseRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=Q(created_by__isnull=False), name="%(app_label)s_%(class)s_author"
            )
        ]


class ReleaseContext(ReleaseRecord):
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey("geography.Quadrant", on_delete=models.PROTECT, related_name="+")

    class Meta(ReleaseRecord.Meta):
        abstract = True


class PermitType(ReleaseRecord):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    requirements = models.JSONField()

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="releases_type_code"),
        ]


class Permit(ReleaseContext):
    code = models.CharField(max_length=50)

    class Meta(ReleaseContext.Meta):
        constraints = [
            *ReleaseContext.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="releases_permit_code"),
        ]


class PermitVersion(ReleaseRecord):
    permit = models.ForeignKey(Permit, on_delete=models.PROTECT, related_name="versions")
    revision = models.PositiveIntegerField()
    type = models.ForeignKey(PermitType, on_delete=models.PROTECT, related_name="+")
    number = models.CharField(max_length=100)
    authority = models.CharField(max_length=300)
    official_document = models.ForeignKey(
        "uploads.UploadVerification", on_delete=models.PROTECT, related_name="permit_versions"
    )
    document_attestation = models.TextField()
    geometry = models.JSONField()
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    scope_center_lookup: ClassVar[str] = "permit__center_id"
    scope_quadrant_lookup: ClassVar[str] = "permit__quadrant_id"

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.UniqueConstraint(fields=["permit", "revision"], name="releases_permit_version"),
            models.UniqueConstraint(
                fields=["official_document"], name="releases_permit_version_document"
            ),
            models.CheckConstraint(condition=Q(revision__gt=0), name="releases_permit_revision"),
            models.CheckConstraint(
                condition=Q(valid_to__gt=models.F("valid_from")), name="releases_permit_validity"
            ),
        ]


class PermitSuspension(ReleaseRecord):
    permit = models.OneToOneField(Permit, on_delete=models.PROTECT, related_name="suspension")
    revision = models.PositiveIntegerField()
    reason = models.TextField()
    effective_from = models.DateTimeField()
    scope_center_lookup: ClassVar[str] = "permit__center_id"
    scope_quadrant_lookup: ClassVar[str] = "permit__quadrant_id"

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.CheckConstraint(condition=Q(revision__gt=1), name="releases_suspend_revision"),
        ]


class PermitSuspensionNotice(ReleaseRecord):
    suspension = models.ForeignKey(
        PermitSuspension, on_delete=models.PROTECT, related_name="notices"
    )
    recipient = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    kind = models.CharField(
        max_length=16, choices=[("courier", "courier"), ("coordinator", "coordinator")]
    )
    status = models.CharField(
        max_length=24,
        choices=[("recorded", "recorded"), ("delivery_unavailable", "delivery_unavailable")],
    )
    scope_snapshot = models.JSONField()

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["suspension", "recipient"], name="releases_suspension_recipient"
            ),
            models.CheckConstraint(
                condition=Q(kind__in=["courier", "coordinator"]), name="releases_notice_kind"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["recorded", "delivery_unavailable"]),
                name="releases_notice_status",
            ),
        ]


class ReleaseDevice(ReleaseContext):
    code = models.CharField(max_length=50)
    source_lot = models.ForeignKey("inventory.Lot", on_delete=models.PROTECT, related_name="+")
    source_lot_version = models.ForeignKey(
        "inventory.LotVersion", on_delete=models.PROTECT, related_name="+"
    )
    status = models.CharField(max_length=16, choices=[("active", "active")], default="active")

    class Meta(ReleaseContext.Meta):
        constraints = [
            *ReleaseContext.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="releases_device_code"),
            models.CheckConstraint(condition=Q(status="active"), name="releases_device_status"),
        ]


class ReleaseDeviceStatus(ReleaseRecord):
    device = models.ForeignKey(ReleaseDevice, on_delete=models.PROTECT, related_name="statuses")
    revision = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=[("active", "active"), ("inactive", "inactive"), ("retired", "retired")],
    )
    reason = models.TextField()
    scope_center_lookup: ClassVar[str] = "device__center_id"
    scope_quadrant_lookup: ClassVar[str] = "device__quadrant_id"

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.UniqueConstraint(fields=["device", "revision"], name="releases_device_revision"),
            models.CheckConstraint(
                condition=Q(revision__gt=1), name="releases_device_status_revision"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["active", "inactive", "retired"]),
                name="releases_device_status_kind",
            ),
        ]


class ReleaseSchedule(ReleaseRecord):
    task = models.OneToOneField(
        "scheduling.ScheduledTask", on_delete=models.PROTECT, related_name="release_schedule"
    )
    permit_version = models.ForeignKey(
        PermitVersion, on_delete=models.PROTECT, related_name="scheduled_releases"
    )
    scope_center_lookup: ClassVar[str] = "permit_version__permit__center_id"
    scope_quadrant_lookup: ClassVar[str] = "permit_version__permit__quadrant_id"


class Release(ReleaseRecord):
    declared_event_id = models.UUIDField(unique=True)
    permit_version = models.ForeignKey(
        PermitVersion, on_delete=models.PROTECT, related_name="releases"
    )
    lot = models.ForeignKey("inventory.Lot", on_delete=models.PROTECT, related_name="releases")
    release_device = models.ForeignKey(
        ReleaseDevice, on_delete=models.PROTECT, related_name="releases"
    )
    training_version = models.ForeignKey(
        "people.TrainingVersion", on_delete=models.PROTECT, related_name="+"
    )
    schedule_task = models.ForeignKey(
        "scheduling.ScheduledTask", on_delete=models.PROTECT, related_name="releases"
    )
    quantity = models.DecimalField(max_digits=QUANTITY_DIGITS, decimal_places=QUANTITY_PLACES)
    location = models.JSONField()
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    provenance = models.JSONField()
    scope_center_lookup: ClassVar[str] = "permit_version__permit__center_id"
    scope_quadrant_lookup: ClassVar[str] = "permit_version__permit__quadrant_id"

    class Meta(ReleaseRecord.Meta):
        constraints = [
            *ReleaseRecord.Meta.constraints,
            models.CheckConstraint(condition=Q(quantity__gt=0), name="releases_quantity_positive"),
            models.UniqueConstraint(fields=["schedule_task"], name="releases_task_once"),
        ]
