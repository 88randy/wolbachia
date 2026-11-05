"""Field events: what the phone recorded, kept exactly as received and never modified.

A `FieldEvent` is the server's copy of one event of the phone's outbox. The ingest status is
final (`accepted`, `rejected` or `in_review`); what a supervisor later decides about a flagged
event lives in `reviews.ReviewItem` decisions (#22), never here. Corrections are void events
(`record.void`) that reference the original (`voids_event`) and set its void fields.
"""

from typing import ClassVar

from django.db import models
from django.db.models import Q

from core.models import (
    ImmutableMixin,
    ImmutableQuerySet,
    OrgScopedModel,
    VoidableMixin,
    VoidableQuerySet,
)

TYPE_MAX_LENGTH = 64
VERSION_MAX_LENGTH = 64
SHA256_HEX_LENGTH = 64
CODE_MAX_LENGTH = 64
STATUS_MAX_LENGTH = 20
ACCEPTED_CODE = "accepted"


class EventStatus(models.TextChoices):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    IN_REVIEW = "in_review"


class FieldEventQuerySet(ImmutableQuerySet, VoidableQuerySet):  # type: ignore[override]
    """Insert-only rows that can still be voided."""


class FieldEvent(ImmutableMixin, VoidableMixin, OrgScopedModel):
    """One event received from a phone. The primary key is the UUID the phone generated.

    Insert-only: only the void fields can change, and only from null (a PostgreSQL trigger in
    the migration enforces it and forbids deleting). `created_by` is the user of the session
    that sent the event (`user` in the API). `payload` is the raw JSON the phone sent, kept
    even when the event is rejected; `payload_sha256` detects an id reused with other content.
    `server_received_at` is when the server got the batch; `device_time` is the phone's clock.
    `clock_skew_seconds` is the skew of the batch (`sent_at - server_received_at`).
    `shift_id` has no foreign key until the shift model exists (#8). `voids_event` is set only
    on accepted or in-review `record.void` events (the target was verified).
    """

    mutable_fields: ClassVar[frozenset[str]] = frozenset(
        {"voided_at", "voided_by", "void_reason", "void_reason_code"}
    )

    type = models.CharField(max_length=TYPE_MAX_LENGTH, db_index=True)
    schema_version = models.PositiveSmallIntegerField()
    payload = models.JSONField()
    payload_sha256 = models.CharField(max_length=SHA256_HEX_LENGTH)
    device = models.ForeignKey("accounts.Device", on_delete=models.PROTECT, related_name="+")
    shift_id = models.UUIDField(null=True, blank=True)
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    clock_skew_seconds = models.BigIntegerField(null=True, blank=True)
    gps_lat = models.FloatField(null=True, blank=True)
    gps_lng = models.FloatField(null=True, blank=True)
    gps_accuracy_m = models.FloatField(null=True, blank=True)
    rules_version = models.CharField(max_length=VERSION_MAX_LENGTH, blank=True)
    catalog_version = models.CharField(max_length=VERSION_MAX_LENGTH, blank=True)
    manual_capture = models.BooleanField(default=False)
    voids_event = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    status = models.CharField(max_length=STATUS_MAX_LENGTH, choices=EventStatus.choices)
    status_code = models.CharField(max_length=CODE_MAX_LENGTH)
    status_params = models.JSONField(default=dict)
    is_final_upload = models.BooleanField(default=False)

    objects = FieldEventQuerySet.as_manager()  # type: ignore[misc,assignment]

    class Meta(ImmutableMixin.Meta, VoidableMixin.Meta):
        indexes = [
            models.Index(fields=["organization", "device", "device_time"]),
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "created_by", "server_received_at"]),
        ]
        constraints = [
            *VoidableMixin.Meta.constraints,
            models.CheckConstraint(
                condition=Q(status__in=EventStatus.values), name="field_event_status_valid"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.type}:{self.pk}"


class RejectionQuotaCounter(OrgScopedModel):
    """Mutable bookkeeping per device and organization-local receipt day, not an audit record."""

    device = models.ForeignKey("accounts.Device", on_delete=models.PROTECT, related_name="+")
    local_date = models.DateField()
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["device", "local_date"], name="rejection_quota_device_day_unique"
            ),
        ]
