"""Append-only independent facts alongside the authentic first-pass result chain."""

from django.db import models

from lab.models import LabFact
from lab.policies import MAX_OBSERVATION

RECOUNT_ROLES = [("second", "second"), ("third", "third")]


class LabQAPolicyVersion(LabFact):
    revision = models.PositiveIntegerField()
    absolute_tolerance = models.PositiveBigIntegerField(default=10)
    relative_per_100 = models.PositiveSmallIntegerField(default=10)
    qa_method_version = models.ForeignKey(
        "lab.LabMethodVersion", null=True, on_delete=models.PROTECT, related_name="+"
    )
    reuse_method_version = models.ForeignKey(
        "lab.LabMethodVersion", null=True, on_delete=models.PROTECT, related_name="+"
    )
    content_hash = models.CharField(max_length=64)

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "revision"], name="lab_qa_policy_revision"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    absolute_tolerance__lte=MAX_OBSERVATION, relative_per_100__lte=100
                ),
                name="lab_qa_tolerance_domains",
            ),
        ]


class LabBlindObservation(LabFact):
    count = models.OneToOneField(
        "lab.EggCountAttempt", on_delete=models.PROTECT, related_name="blind_boundary"
    )
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="blind_boundary"
    )
    policy_version = models.CharField(max_length=32, default="lab.blind.v1")


class LabNumericDisclosure(LabFact):
    count = models.ForeignKey(
        "lab.EggCountAttempt", on_delete=models.PROTECT, related_name="numeric_disclosures"
    )
    surface = models.CharField(
        max_length=24,
        choices=[
            (name, name)
            for name in (
                "result",
                "void_context",
                "request",
                "history",
                "replay",
                "physical_assessment",
            )
        ],
    )

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["count", "created_by"], name="lab_numeric_disclosure_once"
            ),
        ]


class RecountIndependenceAttestation(LabFact):
    request = models.ForeignKey(
        "lab.RecountRequest", on_delete=models.PROTECT, related_name="independence_attestations"
    )
    first_result = models.ForeignKey(
        "lab.LabResultRevision", on_delete=models.PROTECT, related_name="+"
    )
    counter = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    role = models.CharField(max_length=6, choices=RECOUNT_ROLES)
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="independence_attestation"
    )
    external_reference = models.UUIDField()
    reason_code = models.CharField(max_length=64)
    reason = models.TextField()
    authority_proof = models.JSONField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["request", "counter", "role", "first_result"],
                name="lab_independence_attestation_once",
            ),
        ]


class RecountClaim(LabFact):
    request = models.ForeignKey(
        "lab.RecountRequest", on_delete=models.PROTECT, related_name="claims"
    )
    role = models.CharField(max_length=6, choices=RECOUNT_ROLES)
    counter = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="successor"
    )
    first_result = models.ForeignKey(
        "lab.LabResultRevision", on_delete=models.PROTECT, related_name="+"
    )
    policy = models.ForeignKey(LabQAPolicyVersion, on_delete=models.PROTECT)
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="recount_claim"
    )
    independence_proof = models.JSONField()


class RecountAttempt(LabFact):
    request = models.ForeignKey(
        "lab.RecountRequest", on_delete=models.PROTECT, related_name="attempts"
    )
    claim = models.OneToOneField(RecountClaim, on_delete=models.PROTECT, related_name="attempt")
    receipt = models.ForeignKey(
        "lab.BagReceipt", on_delete=models.PROTECT, related_name="independent_attempts"
    )
    bag = models.ForeignKey(
        "ovitraps.Bag", on_delete=models.PROTECT, related_name="independent_attempts"
    )
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="recount_attempt"
    )
    role = models.CharField(max_length=6, choices=RECOUNT_ROLES)
    value = models.PositiveBigIntegerField()
    viable_eggs = models.PositiveBigIntegerField(null=True)
    total_examined = models.PositiveBigIntegerField(null=True)
    viability_percent = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    viability_reason = models.CharField(max_length=20, blank=True)
    method_version = models.ForeignKey(
        "lab.LabMethodVersion", on_delete=models.PROTECT, related_name="+"
    )
    verification = models.ForeignKey(
        "lab.LabMethodVerification", on_delete=models.PROTECT, related_name="+"
    )
    rules = models.JSONField()
    source_proof = models.JSONField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["request", "role"], name="lab_independent_role_once"),
            models.CheckConstraint(
                condition=models.Q(value__lte=MAX_OBSERVATION), name="lab_recount_wire_integer"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    viable_eggs__isnull=True,
                    total_examined__isnull=True,
                    viability_percent__isnull=True,
                    viability_reason="not_requested",
                )
                | (
                    models.Q(
                        viable_eggs__isnull=False,
                        total_examined__isnull=False,
                        viable_eggs__lte=models.F("total_examined"),
                        total_examined__lte=MAX_OBSERVATION,
                    )
                    & (
                        models.Q(
                            total_examined=0,
                            viability_percent__isnull=True,
                            viability_reason="zero_examined",
                        )
                        | models.Q(
                            total_examined__gt=0,
                            viability_percent__isnull=False,
                            viability_percent__gte=0,
                            viability_percent__lte=100,
                            viability_reason="",
                        )
                    )
                ),
                name="lab_recount_viability_facts",
            ),
        ]


class RecountResolution(LabFact):
    request = models.ForeignKey(
        "lab.RecountRequest", on_delete=models.PROTECT, related_name="resolutions"
    )
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="successor"
    )
    first_result = models.ForeignKey(
        "lab.LabResultRevision", on_delete=models.PROTECT, related_name="+"
    )
    second = models.ForeignKey(RecountAttempt, on_delete=models.PROTECT, related_name="+")
    third = models.ForeignKey(RecountAttempt, null=True, on_delete=models.PROTECT, related_name="+")
    selected_count = models.ForeignKey(
        "lab.EggCountAttempt", null=True, on_delete=models.PROTECT, related_name="+"
    )
    selected_attempt = models.ForeignKey(
        RecountAttempt, null=True, on_delete=models.PROTECT, related_name="+"
    )
    policy = models.ForeignKey(LabQAPolicyVersion, on_delete=models.PROTECT)
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="recount_resolution"
    )
    comparison_proof = models.JSONField()
    reason_code = models.CharField(max_length=64)
    reason = models.TextField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(selected_count__isnull=False, selected_attempt__isnull=True)
                | models.Q(selected_count__isnull=True, selected_attempt__isnull=False),
                name="lab_resolution_exact_candidate",
            ),
        ]


class RecountRevision(LabFact):
    request = models.ForeignKey(
        "lab.RecountRequest", on_delete=models.PROTECT, related_name="qa_revisions"
    )
    revision = models.PositiveIntegerField()
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="successor"
    )
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="recount_revision"
    )
    claim = models.OneToOneField(
        RecountClaim, null=True, on_delete=models.PROTECT, related_name="qa_revision"
    )
    attempt = models.OneToOneField(
        RecountAttempt, null=True, on_delete=models.PROTECT, related_name="qa_revision"
    )
    resolution = models.OneToOneField(
        RecountResolution, null=True, on_delete=models.PROTECT, related_name="qa_revision"
    )
    attestation = models.OneToOneField(
        RecountIndependenceAttestation,
        null=True,
        on_delete=models.PROTECT,
        related_name="qa_revision",
    )

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["request", "revision"], name="lab_recount_revision"),
            models.CheckConstraint(
                condition=models.Q(
                    claim__isnull=False,
                    attempt__isnull=True,
                    resolution__isnull=True,
                    attestation__isnull=True,
                )
                | models.Q(
                    claim__isnull=True,
                    attempt__isnull=False,
                    resolution__isnull=True,
                    attestation__isnull=True,
                )
                | models.Q(
                    claim__isnull=True,
                    attempt__isnull=True,
                    resolution__isnull=False,
                    attestation__isnull=True,
                )
                | models.Q(
                    claim__isnull=True,
                    attempt__isnull=True,
                    resolution__isnull=True,
                    attestation__isnull=False,
                ),
                name="lab_recount_revision_one_fact",
            ),
        ]


class EggPaddle(LabFact):
    code = models.CharField(max_length=50)
    piece = models.OneToOneField(
        "inventory.Piece", on_delete=models.PROTECT, related_name="egg_paddle"
    )
    source_movement = models.ForeignKey(
        "inventory.StockMovement", on_delete=models.PROTECT, related_name="+"
    )
    location = models.ForeignKey("inventory.Location", on_delete=models.PROTECT, related_name="+")
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="egg_paddle"
    )
    evidence_ids = models.JSONField()
    source_proof = models.JSONField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="lab_paddle_org_code"),
        ]


class PaddleBagBinding(LabFact):
    paddle = models.ForeignKey(EggPaddle, on_delete=models.PROTECT, related_name="bindings")
    cycle = models.PositiveIntegerField()
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="successor"
    )
    bag = models.OneToOneField(
        "ovitraps.Bag", on_delete=models.PROTECT, related_name="paddle_binding"
    )
    source = models.ForeignKey("field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+")
    issue_movement = models.ForeignKey(
        "inventory.StockMovement", on_delete=models.PROTECT, related_name="paddle_bindings"
    )
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="paddle_binding"
    )
    evidence_ids = models.JSONField()
    source_proof = models.JSONField()

    class Meta(LabFact.Meta):
        ordering = ["-cycle"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["paddle", "cycle"], name="lab_paddle_cycle"),
        ]


class PaddleReuse(LabFact):
    binding = models.OneToOneField(PaddleBagBinding, on_delete=models.PROTECT, related_name="reuse")
    reuse_number = models.PositiveSmallIntegerField()
    first_result = models.ForeignKey(
        "lab.LabResultRevision", on_delete=models.PROTECT, related_name="+"
    )
    qa_revision = models.ForeignKey(
        RecountRevision, null=True, on_delete=models.PROTECT, related_name="+"
    )
    sample_member = models.ForeignKey(
        "lab.DailyRecountSampleMember", null=True, on_delete=models.PROTECT, related_name="+"
    )
    method_version = models.ForeignKey(
        "lab.LabMethodVersion", on_delete=models.PROTECT, related_name="+"
    )
    verification = models.ForeignKey(
        "lab.LabMethodVerification", on_delete=models.PROTECT, related_name="+"
    )
    washed_at = models.DateTimeField()
    dried_at = models.DateTimeField()
    destination = models.ForeignKey(
        "inventory.Location", on_delete=models.PROTECT, related_name="+"
    )
    source_movement = models.ForeignKey(
        "inventory.StockMovement", on_delete=models.PROTECT, related_name="+"
    )
    command = models.OneToOneField(
        "lab.LabCommand", on_delete=models.PROTECT, related_name="paddle_reuse"
    )
    evidence_ids = models.JSONField()
    frame_proof = models.JSONField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(reuse_number__gte=1, reuse_number__lte=2),
                name="lab_paddle_reuse_bounds",
            ),
            models.CheckConstraint(
                condition=models.Q(washed_at__lte=models.F("dried_at")),
                name="lab_paddle_treatment_order",
            ),
        ]
