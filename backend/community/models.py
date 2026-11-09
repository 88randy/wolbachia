"""Immutable aggregate observations and their explicit lifecycle/source receipts."""

from typing import ClassVar
from uuid import UUID

from django.db import models

from community.payloads import MAX_ATTENDANCE
from core.models import ImmutableMixin, OrgScopedModel


class CommunityRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True


class CommunityActivity(CommunityRecord):
    sequence = models.PositiveBigIntegerField()
    code = models.CharField(max_length=30)
    zone = models.ForeignKey("geography.Block", on_delete=models.PROTECT, related_name="+")
    zone_version = models.ForeignKey(
        "geography.BlockVersion", on_delete=models.PROTECT, related_name="+"
    )
    type = models.ForeignKey("catalogs.CatalogItem", on_delete=models.PROTECT, related_name="+")
    type_snapshot = models.JSONField()
    attendance = models.PositiveBigIntegerField()
    agreements = models.TextField(blank=True)
    other_text = models.TextField(blank=True)
    activity_date = models.DateField()
    captured_timezone = models.CharField(max_length=100)
    scope_center_lookup: ClassVar[str] = "zone__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "zone__quadrant_id"

    @property
    def center_id(self) -> UUID:
        return self.zone.quadrant.center_id

    @property
    def quadrant_id(self) -> UUID:
        return self.zone.quadrant_id

    class Meta(CommunityRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sequence"], name="community_org_sequence"
            ),
            models.UniqueConstraint(fields=["organization", "code"], name="community_org_code"),
            models.CheckConstraint(
                condition=models.Q(attendance__lte=MAX_ATTENDANCE), name="community_safe_attendance"
            ),
        ]


class CommunityActivityEvent(CommunityRecord):
    activity = models.ForeignKey(CommunityActivity, on_delete=models.PROTECT, related_name="events")
    revision = models.PositiveSmallIntegerField()
    action = models.CharField(max_length=6, choices=[("create", "create"), ("void", "void")])
    command_id = models.UUIDField()
    origin = models.CharField(max_length=5, choices=[("http", "http"), ("field", "field")])
    device_time = models.DateTimeField(null=True)
    server_received_at = models.DateTimeField()
    declared_source_uuid = models.UUIDField(null=True)
    source_payload_hash = models.CharField(max_length=64, blank=True)
    source_identity = models.JSONField(default=dict)
    body_hash = models.CharField(max_length=64)
    reason = models.TextField(blank=True)
    reason_code = models.CharField(max_length=64, blank=True)

    class Meta(CommunityRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["activity", "revision"], name="community_event_revision"
            ),
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="community_event_command"
            ),
            models.CheckConstraint(
                condition=models.Q(action="create", revision=1, reason="", reason_code="")
                | (models.Q(action="void", revision=2) & ~models.Q(reason_code="")),
                name="community_event_phase",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    origin="http",
                    device_time__isnull=True,
                    declared_source_uuid__isnull=True,
                    source_payload_hash="",
                    source_identity={},
                )
                | (
                    models.Q(
                        origin="field",
                        device_time__isnull=False,
                        declared_source_uuid__isnull=False,
                    )
                    & ~models.Q(source_payload_hash="")
                    & ~models.Q(source_identity={})
                ),
                name="community_event_origin",
            ),
        ]


class CommunityCommandReceipt(CommunityRecord):
    command_id = models.UUIDField()
    event = models.OneToOneField(
        CommunityActivityEvent, on_delete=models.PROTECT, related_name="receipt"
    )
    operation = models.CharField(max_length=6, choices=[("create", "create"), ("void", "void")])
    target_id = models.UUIDField()
    origin = models.CharField(max_length=5, choices=[("http", "http"), ("field", "field")])
    body_hash = models.CharField(max_length=64)
    command = models.JSONField()
    response = models.JSONField()

    class Meta(CommunityRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="community_command_identity"
            )
        ]


class CommunitySourceLink(CommunityRecord):
    event = models.OneToOneField(
        CommunityActivityEvent, on_delete=models.PROTECT, related_name="source_link"
    )
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="community_link"
    )


class ComplaintIncidentLink(CommunityRecord):
    activity = models.OneToOneField(
        CommunityActivity, on_delete=models.PROTECT, related_name="complaint_link"
    )
    incident = models.ForeignKey(
        "incidents.Incident", on_delete=models.PROTECT, related_name="community_links"
    )
    reason = models.TextField()


class CommunitySourceCancellation(CommunityRecord):
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="community_cancellation"
    )
    target_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="community_cancellations"
    )
    source_payload_hash = models.CharField(max_length=64)
    reason = models.TextField()
    reason_code = models.CharField(max_length=64)
