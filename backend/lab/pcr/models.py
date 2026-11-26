"""PCR batches sent to external laboratories: insert-only facts; status is derived from events."""

from typing import ClassVar

from django.db import models
from django.db.models import Q

from core.models import OrgScopedModel
from lab.models import LabFact

TARGETS = ("wolbachia", "dengue")
OUTCOMES = ("positive", "negative", "invalid")
SEROTYPES = ("DENV-1", "DENV-2", "DENV-3", "DENV-4")
STATUSES = (
    "preparing",
    "ready_to_ship",
    "shipped",
    "received_by_lab",
    "results_received",
    "closed",
    "voided",
)
# Transition event kind -> (required current status, next status).
TRANSITIONS: dict[str, tuple[str, str]] = {
    "ready": ("preparing", "ready_to_ship"),
    "ship": ("ready_to_ship", "shipped"),
    "receive": ("shipped", "received_by_lab"),
    "results": ("received_by_lab", "results_received"),
    "close": ("results_received", "closed"),
}
EVENT_KINDS = (*TRANSITIONS, "undo", "void")


class ExternalLab(OrgScopedModel):
    """Per-organization catalog of external laboratories; deactivated, never deleted."""

    name = models.CharField(max_length=200)
    contact = models.CharField(max_length=200, blank=True)
    address = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(fields=["organization", "name"], name="pcr_external_lab_name")
        ]


class PcrBatch(LabFact):
    code = models.CharField(max_length=30)
    external_lab = models.ForeignKey(ExternalLab, on_delete=models.PROTECT, related_name="+")
    targets = models.JSONField()
    notes = models.TextField(blank=True)

    class Meta(LabFact.Meta):
        ordering = ["-created_at"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="pcr_batch_code"),
        ]


class PcrBatchSample(LabFact):
    batch = models.ForeignKey(PcrBatch, on_delete=models.PROTECT, related_name="samples")
    sample = models.ForeignKey(
        "lab.WolbachiaSample", on_delete=models.PROTECT, related_name="pcr_entries"
    )

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["batch", "sample"], name="pcr_batch_sample_once"),
        ]


class PcrBatchEvent(LabFact):
    """One status step, an undo of the latest step or the void of the whole batch."""

    batch = models.ForeignKey(PcrBatch, on_delete=models.PROTECT, related_name="events")
    kind = models.CharField(max_length=10, choices=[(kind, kind) for kind in EVENT_KINDS])
    occurred_at = models.DateTimeField()
    carrier = models.CharField(max_length=200, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    evidence = models.ForeignKey(
        "uploads.UploadVerification", null=True, on_delete=models.PROTECT, related_name="+"
    )
    undoes = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="undone_by"
    )
    reason = models.TextField(blank=True)

    class Meta(LabFact.Meta):
        ordering = ["created_at"]
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=Q(kind="undo", undoes__isnull=False) | ~Q(kind="undo"),
                name="pcr_event_undo_target",
            ),
            models.CheckConstraint(
                condition=Q(kind__in=["undo", "void"], reason__gt="")
                | ~Q(kind__in=["undo", "void"]),
                name="pcr_event_reason",
            ),
        ]


class PcrResult(LabFact):
    batch = models.ForeignKey(PcrBatch, on_delete=models.PROTECT, related_name="results")
    sample = models.ForeignKey(
        "lab.WolbachiaSample", on_delete=models.PROTECT, related_name="pcr_results"
    )
    target = models.CharField(max_length=10, choices=[(value, value) for value in TARGETS])
    outcome = models.CharField(max_length=10, choices=[(value, value) for value in OUTCOMES])
    serotype = models.CharField(max_length=6, blank=True)
    ct_value = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    supersedes = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="superseded_by"
    )
    wolbachia_attempt = models.OneToOneField(
        "lab.WolbachiaResultAttempt", null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(LabFact.Meta):
        ordering = ["created_at"]
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=Q(serotype="")
                | Q(target="dengue", outcome="positive", serotype__in=SEROTYPES),
                name="pcr_result_serotype",
            ),
            models.CheckConstraint(
                condition=Q(target="dengue", wolbachia_attempt__isnull=True)
                | Q(target="wolbachia", wolbachia_attempt__isnull=False),
                name="pcr_result_wolbachia_attempt",
            ),
            models.CheckConstraint(
                condition=Q(ct_value__isnull=True) | Q(ct_value__gte=0, ct_value__lte=60),
                name="pcr_result_ct_range",
            ),
        ]


class PcrResultVoid(LabFact):
    result = models.OneToOneField(PcrResult, on_delete=models.PROTECT, related_name="void")
    reason = models.TextField()


class PcrReport(LabFact):
    """The external laboratory's report file (verified PDF upload)."""

    batch = models.ForeignKey(PcrBatch, on_delete=models.PROTECT, related_name="reports")
    document = models.OneToOneField(
        "uploads.UploadVerification", on_delete=models.PROTECT, related_name="+"
    )
