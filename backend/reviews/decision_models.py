"""Append-only human decisions and exact effect/publication receipts."""

from django.db import models

from reviews.base import ReviewAudit


class ReviewDecision(ReviewAudit):
    review_item = models.ForeignKey(
        "reviews.ReviewItem", on_delete=models.PROTECT, related_name="decisions"
    )
    revision = models.PositiveIntegerField()
    expected_revision = models.PositiveIntegerField()
    is_terminal = models.BooleanField(default=False)
    kind = models.CharField(
        max_length=16,
        choices=[("accept", "accept"), ("void", "void"), ("open_incident", "open_incident")],
    )
    reason = models.TextField()
    evidence_ids = models.JSONField(default=list)
    evaluation = models.JSONField(default=dict)

    @property
    def decision_state(self) -> str:
        if not self.is_terminal:
            return "pending"
        return "accepted" if self.kind == "accept" else "voided"

    @property
    def audit_only(self) -> bool:
        return self.kind == "void" and not self.is_terminal

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(kind__in=["accept", "void", "open_incident"]),
                name="review_decision_kind",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(kind="accept", is_terminal=True)
                    | models.Q(kind="void", is_terminal=True)
                    | models.Q(
                        kind="void",
                        is_terminal=False,
                        evaluation__contains={"scope_resolved": False},
                    )
                    | models.Q(kind="open_incident", is_terminal=False)
                ),
                name="review_terminal_kind",
            ),
            models.UniqueConstraint(fields=["review_item", "revision"], name="review_decision_rev"),
            models.UniqueConstraint(
                fields=["review_item"],
                condition=models.Q(is_terminal=True),
                name="review_one_terminal_decision",
            ),
            models.UniqueConstraint(
                fields=["review_item"],
                condition=models.Q(kind="open_incident"),
                name="review_one_incident_decision",
            ),
            models.CheckConstraint(
                condition=models.Q(revision=models.F("expected_revision") + 1),
                name="review_next_expected_revision",
            ),
        ]


class ReviewEffectReceipt(ReviewAudit):
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_effect_receipt"
    )
    decision = models.OneToOneField(
        ReviewDecision, on_delete=models.PROTECT, related_name="effect_receipt"
    )
    mode = models.CharField(
        max_length=20,
        choices=[("applied_review", "applied_review"), ("adopted_legacy", "adopted_legacy")],
    )
    payload_sha256 = models.CharField(max_length=64)
    handler_version = models.CharField(max_length=80)
    materialization = models.JSONField()
    authority_proofs = models.JSONField(default=list)
    observations = models.JSONField(default=list)


class ShiftDecision(ReviewAudit):
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="decisions")
    closed_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )
    revision = models.PositiveIntegerField()
    expected_revision = models.PositiveIntegerField()
    kind = models.CharField(max_length=8, choices=[("approve", "approve"), ("observe", "observe")])
    reason = models.TextField()
    validation_fingerprint = models.CharField(max_length=64)
    subjects = models.JSONField(default=list)

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(kind__in=["approve", "observe"]), name="shift_decision_kind"
            ),
            models.UniqueConstraint(fields=["shift", "revision"], name="shift_decision_revision"),
            models.CheckConstraint(
                condition=models.Q(revision=models.F("expected_revision") + 1),
                name="shift_next_expected_revision",
            ),
        ]


class ReviewIncidentLink(ReviewAudit):
    review_item = models.OneToOneField(
        "reviews.ReviewItem", on_delete=models.PROTECT, related_name="incident_link"
    )
    decision = models.OneToOneField(ReviewDecision, on_delete=models.PROTECT, related_name="+")
    incident = models.OneToOneField(
        "incidents.Incident", on_delete=models.PROTECT, related_name="+"
    )


class HistoryPublicationReceipt(ReviewAudit):
    cause_kind = models.CharField(max_length=32)
    cause_id = models.UUIDField()
    courier = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    resource_type = models.CharField(max_length=32)
    resource_id = models.UUIDField()
    resource_version = models.CharField(max_length=64)
    change = models.OneToOneField(
        "field_sync.CourierChange", on_delete=models.PROTECT, related_name="history_receipt"
    )

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.UniqueConstraint(
                fields=[
                    "cause_kind",
                    "cause_id",
                    "courier",
                    "resource_type",
                    "resource_id",
                    "resource_version",
                ],
                name="history_publication_identity",
            ),
        ]


class ReviewSafetyDisposition(ReviewAudit):
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_safety_disposition"
    )
    review_item = models.OneToOneField(
        "reviews.ReviewItem", on_delete=models.PROTECT, related_name="safety_disposition"
    )
    decision = models.OneToOneField(
        ReviewDecision, on_delete=models.PROTECT, related_name="safety_disposition"
    )
    motorcycle = models.ForeignKey("shifts.Motorcycle", on_delete=models.PROTECT, related_name="+")
    inspection = models.ForeignKey(
        "fleet.ServiceRecord", on_delete=models.PROTECT, related_name="review_safety_dispositions"
    )
    evidence_ids = models.JSONField()
    inspection_snapshot = models.JSONField()
    policy_version = models.CharField(max_length=40, default="reviews.safety.v1")
    attest_safe_now = models.BooleanField()

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(attest_safe_now=True), name="review_safety_current_attestation"
            ),
        ]
