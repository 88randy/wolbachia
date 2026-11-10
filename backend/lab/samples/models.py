"""Immutable sample sources, reception and explicit analytical result attempts."""

from typing import ClassVar

from django.db import models
from django.db.models import Q

from lab.models import LabFact


class WolbachiaSample(LabFact):
    code = models.CharField(max_length=50)
    event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="wolbachia_sample"
    )
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, on_delete=models.PROTECT, related_name="+"
    )
    reading = models.ForeignKey(
        "ovitraps.OvitrapReading", null=True, on_delete=models.PROTECT, related_name="+"
    )
    lot = models.ForeignKey("inventory.Lot", null=True, on_delete=models.PROTECT, related_name="+")
    release = models.ForeignKey(
        "releases.Release", null=True, on_delete=models.PROTECT, related_name="+"
    )
    method_version = models.ForeignKey(
        "lab.LabMethodVersion", on_delete=models.PROTECT, related_name="+"
    )
    origin_snapshot = models.JSONField()
    other_text = models.TextField(blank=True)
    source_provenance = models.JSONField()
    location = models.JSONField()
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "code"], name="lab_wolbachia_sample_code"
            ),
            models.CheckConstraint(
                condition=Q(reading__isnull=False, lot__isnull=True, release__isnull=True)
                | Q(reading__isnull=True, lot__isnull=False, release__isnull=True)
                | Q(reading__isnull=True, lot__isnull=True, release__isnull=False),
                name="lab_sample_one_source",
            ),
        ]


class SampleReceipt(LabFact):
    sample = models.OneToOneField(WolbachiaSample, on_delete=models.PROTECT, related_name="receipt")
    command_id = models.UUIDField()
    scope_center_lookup: ClassVar[str] = "sample__center_id"
    scope_quadrant_lookup: ClassVar[str] = "sample__quadrant_id"


class WolbachiaResultAttempt(LabFact):
    sample = models.ForeignKey(WolbachiaSample, on_delete=models.PROTECT, related_name="attempts")
    command_id = models.UUIDField()
    revision = models.PositiveIntegerField()
    status = models.CharField(
        max_length=10, choices=[(value, value) for value in ("valid", "invalid", "disputed")]
    )
    result = models.CharField(  # noqa: DJ001 -- unknown assay outcome is explicitly null.
        max_length=8, null=True, choices=[("positive", "positive"), ("negative", "negative")]
    )
    method_version = models.ForeignKey(
        "lab.LabMethodVersion", on_delete=models.PROTECT, related_name="+"
    )
    method_verification = models.ForeignKey(
        "lab.LabMethodVerification", on_delete=models.PROTECT, related_name="+"
    )
    repeat_of = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="repeat"
    )
    scope_center_lookup: ClassVar[str] = "sample__center_id"
    scope_quadrant_lookup: ClassVar[str] = "sample__quadrant_id"

    class Meta(LabFact.Meta):
        ordering = ["revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["sample", "revision"], name="lab_wolbachia_attempt_revision"
            ),
            models.CheckConstraint(condition=Q(revision__gt=0), name="lab_sample_attempt_positive"),
            models.CheckConstraint(
                condition=Q(
                    status="valid", result__in=["positive", "negative"], result__isnull=False
                )
                | Q(status__in=["invalid", "disputed"], result__isnull=True),
                name="lab_wolbachia_explicit_result",
            ),
        ]


class SampleCommandReceipt(LabFact):
    sample = models.ForeignKey(WolbachiaSample, on_delete=models.PROTECT, related_name="commands")
    command_id = models.UUIDField()
    action = models.CharField(
        max_length=8, choices=[("receive", "receive"), ("results", "results")]
    )
    body_hash = models.CharField(max_length=64)
    response = models.JSONField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="lab_sample_command_once"
            ),
        ]
