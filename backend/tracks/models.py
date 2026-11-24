"""The courier track (#370): where the courier went during an open shift.

Both models are insert-only (model, manager and a PostgreSQL trigger in migration 0001). A track
is never edited or deleted on the server: a wrong segment is corrected by voiding its source
`track.segment` event, and reads skip voided sources.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import ImmutableMixin, OrgScopedModel

KIND_MAX_LENGTH = 10


class TrackSegment(ImmutableMixin, OrgScopedModel):
    """One accepted `track.segment` event, trimmed to its shift window.

    `positions` is `[[offset_s, lat, lng, accuracy_m], ...]` with offsets in seconds from
    `started_at_device` (non-decreasing). Times marked `_device` are the phone's clock; the source
    event keeps the server receipt time. `trimmed_count` counts the positions the server dropped
    because they fell outside `[opened_at_device, closed_at_device]` of the shift.
    """

    field_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="+")
    courier = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    started_at_device = models.DateTimeField()
    ended_at_device = models.DateTimeField()
    position_count = models.PositiveSmallIntegerField()
    positions = models.JSONField()
    trimmed_count = models.PositiveSmallIntegerField(default=0)

    class Meta(ImmutableMixin.Meta):
        indexes = [
            models.Index(fields=["shift", "ended_at_device"]),
            models.Index(fields=["organization", "courier", "started_at_device"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(position_count__gte=1, position_count__lte=250),
                name="track_segment_position_count_range",
            ),
            models.CheckConstraint(
                condition=Q(ended_at_device__gte=models.F("started_at_device")),
                name="track_segment_ends_after_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shift_id}:{self.started_at_device.isoformat()}"


class TrackViewKind(models.TextChoices):
    LIVE = "live"
    TRACK = "track"


class TrackViewReceipt(ImmutableMixin, OrgScopedModel):
    """Who read courier positions or a shift track, at most once per viewer, kind, shift and hour.

    `shift` is null for the live list (`kind=live`). `hour` is the UTC hour of the read. Polling
    every 30 s adds nothing: the unique constraint (nulls not distinct) absorbs repeats.
    """

    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    shift = models.ForeignKey(
        "shifts.Shift", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    kind = models.CharField(max_length=KIND_MAX_LENGTH, choices=TrackViewKind.choices)
    hour = models.DateTimeField()

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "viewer", "kind", "shift", "hour"],
                name="track_view_receipt_once_per_hour",
                nulls_distinct=False,
            ),
            models.CheckConstraint(
                condition=Q(kind__in=TrackViewKind.values), name="track_view_receipt_kind_valid"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.viewer_id}:{self.kind}:{self.hour.isoformat()}"
