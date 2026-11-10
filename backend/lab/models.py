"""Immutable lab facts; current disposition is derived from a retained revision chain."""

from typing import ClassVar

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel
from lab.policies import MAX_OBSERVATION


class LabFact(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=models.Q(created_by__isnull=False),
                name="%(app_label)s_%(class)s_author",
            )
        ]


class LabSystemFact(ImmutableMixin, OrgScopedModel):
    actor_kind = models.CharField(max_length=6, choices=[("human", "human"), ("system", "system")])
    policy_version = models.CharField(max_length=64)

    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(actor_kind="human", created_by__isnull=False)
                    | models.Q(actor_kind="system", created_by__isnull=True)
                )
                & ~models.Q(policy_version=""),
                name="%(app_label)s_%(class)s_author",
            )
        ]


class LabCommand(LabFact):
    command_id = models.UUIDField()
    action = models.CharField(max_length=32)
    target_id = models.UUIDField()
    input_hash = models.CharField(max_length=64)
    canonical_input = models.JSONField()
    source_id = models.UUIDField(null=True)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "command_id"], name="lab_command_once"),
        ]


class LabCommandResult(LabFact):
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="result")
    status = models.PositiveSmallIntegerField()
    body = models.JSONField()
    # Reauthorize every saved subject before replaying even the cached next candidate.
    subjects = models.JSONField(default=list)
    content_hash = models.CharField(max_length=64)


class BagReceipt(LabFact):
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="receipt")
    reading = models.OneToOneField(
        "ovitraps.OvitrapReading", on_delete=models.PROTECT, related_name="lab_receipt"
    )
    bag = models.OneToOneField(
        "ovitraps.Bag", null=True, on_delete=models.PROTECT, related_name="lab_receipt"
    )
    source = models.ForeignKey("field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+")
    kind = models.CharField(max_length=10, choices=[("bag", "bag"), ("no_paddle", "no_paddle")])
    scope_center_lookup: ClassVar[str] = (
        "reading__ovitrap__sampling_point__block__quadrant__center_id"
    )
    scope_quadrant_lookup: ClassVar[str] = "reading__ovitrap__sampling_point__block__quadrant_id"


class ReceptionDiscrepancy(LabFact):
    bag = models.ForeignKey(
        "ovitraps.Bag", on_delete=models.PROTECT, related_name="lab_discrepancies"
    )
    source = models.ForeignKey("field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+")
    kind = models.CharField(
        max_length=10, choices=[("missing", "missing"), ("no_reading", "no_reading")]
    )
    source_hash = models.CharField(max_length=64)
    source_proof = models.JSONField()
    reason = models.TextField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["bag", "kind", "source_hash"], name="lab_discrepancy_cause_once"
            ),
        ]


class ReceptionIncidentPolicyVersion(LabFact):
    revision = models.PositiveIntegerField()
    missing_type_version = models.ForeignKey(
        "incidents.IncidentTypeVersion", on_delete=models.PROTECT, related_name="+"
    )
    no_reading_type_version = models.ForeignKey(
        "incidents.IncidentTypeVersion", on_delete=models.PROTECT, related_name="+"
    )

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "revision"], name="lab_reception_policy_revision"
            ),
        ]


class ReceptionIncidentLink(LabSystemFact):
    discrepancy = models.OneToOneField(
        ReceptionDiscrepancy, on_delete=models.PROTECT, related_name="incident_link"
    )
    incident = models.OneToOneField(
        "incidents.Incident", on_delete=models.PROTECT, related_name="+"
    )
    policy = models.ForeignKey(ReceptionIncidentPolicyVersion, on_delete=models.PROTECT)


class LabMethod(LabFact):
    code = models.CharField(max_length=50)

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="lab_method_org_code"),
        ]


class LabMethodVersion(LabFact):
    method = models.ForeignKey(LabMethod, on_delete=models.PROTECT, related_name="versions")
    revision = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    procedure = models.TextField()
    reference = models.CharField(max_length=1000)
    effective_from = models.DateTimeField()
    content_hash = models.CharField(max_length=64)
    supports_viability = models.BooleanField()
    supports_rejection = models.BooleanField()
    supports_independent_qa = models.BooleanField(default=False)
    supports_paddle_reuse = models.BooleanField(default=False)

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["method", "revision"], name="lab_method_revision"),
        ]


class LabMethodVerification(LabFact):
    method_version = models.ForeignKey(
        LabMethodVersion, on_delete=models.PROTECT, related_name="verifications"
    )
    revision = models.PositiveIntegerField()
    decision = models.CharField(
        max_length=8, choices=[("verify", "verify"), ("withdraw", "withdraw")]
    )
    reference = models.CharField(max_length=1000)
    content_hash = models.CharField(max_length=64)

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["method_version", "revision"], name="lab_method_verification_revision"
            ),
        ]


class EggCountAttempt(LabFact):
    receipt = models.ForeignKey(BagReceipt, on_delete=models.PROTECT, related_name="counts")
    bag = models.ForeignKey("ovitraps.Bag", on_delete=models.PROTECT, related_name="lab_counts")
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="count")
    ordinal = models.PositiveIntegerField()
    value = models.PositiveBigIntegerField()
    viable_eggs = models.PositiveBigIntegerField(null=True)
    total_examined = models.PositiveBigIntegerField(null=True)
    viability_percent = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    viability_reason = models.CharField(max_length=20, blank=True)
    method_version = models.ForeignKey(LabMethodVersion, null=True, on_delete=models.PROTECT)
    verification = models.ForeignKey(LabMethodVerification, null=True, on_delete=models.PROTECT)
    rules = models.JSONField()
    source_proof = models.JSONField()
    replacement_of = models.ForeignKey(
        "self", null=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["bag", "ordinal"], name="lab_count_ordinal"),
            models.CheckConstraint(
                condition=models.Q(value__lte=MAX_OBSERVATION), name="lab_count_wire_integer"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        viable_eggs__isnull=True,
                        total_examined__isnull=True,
                        viability_percent__isnull=True,
                        method_version__isnull=True,
                        verification__isnull=True,
                        viability_reason="not_requested",
                    )
                    | (
                        models.Q(
                            viable_eggs__isnull=False,
                            total_examined__isnull=False,
                            method_version__isnull=False,
                            verification__isnull=False,
                        )
                        & models.Q(
                            viable_eggs__lte=models.F("total_examined"),
                            total_examined__lte=MAX_OBSERVATION,
                        )
                        & (
                            models.Q(
                                total_examined=0,
                                viability_percent__isnull=True,
                                viability_reason="zero_examined",
                            )
                            | (
                                models.Q(
                                    total_examined__gt=0,
                                    viability_percent__isnull=False,
                                    viability_reason="",
                                )
                                & models.Q(viability_percent__gte=0, viability_percent__lte=100)
                            )
                        )
                    )
                ),
                name="lab_viability_facts",
            ),
        ]


class LabRejection(LabFact):
    receipt = models.ForeignKey(BagReceipt, on_delete=models.PROTECT, related_name="rejections")
    bag = models.ForeignKey("ovitraps.Bag", on_delete=models.PROTECT, related_name="lab_rejections")
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="rejection")
    method_version = models.ForeignKey(LabMethodVersion, on_delete=models.PROTECT)
    verification = models.ForeignKey(LabMethodVerification, on_delete=models.PROTECT)
    reason = models.TextField()
    evidence_ids = models.JSONField()
    source_proof = models.JSONField()


class LabResultVoid(LabFact):
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="void")
    count = models.OneToOneField(
        EggCountAttempt, null=True, on_delete=models.PROTECT, related_name="void_fact"
    )
    rejection = models.OneToOneField(
        LabRejection, null=True, on_delete=models.PROTECT, related_name="void_fact"
    )
    reason_code = models.CharField(max_length=64)
    reason = models.TextField()

    class Meta(LabFact.Meta):
        constraints = [
            *LabFact.Meta.constraints,
            models.CheckConstraint(
                condition=models.Q(count__isnull=False, rejection__isnull=True)
                | models.Q(count__isnull=True, rejection__isnull=False),
                name="lab_void_one_target",
            ),
        ]


class LabResultRevision(LabFact):
    bag = models.ForeignKey("ovitraps.Bag", on_delete=models.PROTECT, related_name="lab_revisions")
    revision = models.PositiveIntegerField()
    previous = models.OneToOneField(
        "self", null=True, on_delete=models.PROTECT, related_name="successor"
    )
    command = models.OneToOneField(LabCommand, on_delete=models.PROTECT, related_name="disposition")
    count = models.OneToOneField(
        EggCountAttempt, null=True, on_delete=models.PROTECT, related_name="result_revision"
    )
    rejection = models.OneToOneField(
        LabRejection, null=True, on_delete=models.PROTECT, related_name="result_revision"
    )
    void = models.OneToOneField(
        LabResultVoid, null=True, on_delete=models.PROTECT, related_name="result_revision"
    )

    class Meta(LabFact.Meta):
        ordering = ["-revision"]
        constraints = [
            *LabFact.Meta.constraints,
            models.UniqueConstraint(fields=["bag", "revision"], name="lab_result_revision"),
            models.CheckConstraint(
                condition=models.Q(count__isnull=True) | models.Q(rejection__isnull=True),
                name="lab_one_current_result",
            ),
            models.CheckConstraint(
                condition=models.Q(count__isnull=False)
                | models.Q(rejection__isnull=False)
                | models.Q(void__isnull=False),
                name="lab_revision_has_fact",
            ),
        ]


class RecountRequest(LabSystemFact):
    count = models.OneToOneField(
        EggCountAttempt, on_delete=models.PROTECT, related_name="recount_request"
    )
    first_counter = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    independent_required = models.BooleanField(default=True)


class RecountRequestCause(LabSystemFact):
    request = models.ForeignKey(RecountRequest, on_delete=models.PROTECT, related_name="causes")
    kind = models.CharField(
        max_length=24,
        choices=[
            (kind, kind)
            for kind in ("implausible", "eggs_flag_absent", "daily_sample", "carried_obligation")
        ],
    )
    proof = models.JSONField()

    class Meta(LabSystemFact.Meta):
        constraints = [
            *LabSystemFact.Meta.constraints,
            models.UniqueConstraint(fields=["request", "kind"], name="lab_request_cause_once"),
        ]


class RecountRequestSupersession(LabFact):
    request = models.OneToOneField(
        RecountRequest, on_delete=models.PROTECT, related_name="supersession"
    )
    void = models.ForeignKey(LabResultVoid, on_delete=models.PROTECT)
    replacement = models.ForeignKey(
        RecountRequest, null=True, on_delete=models.PROTECT, related_name="+"
    )


class DailyRecountSample(LabSystemFact):
    local_day = models.DateField()
    revision = models.PositiveIntegerField()
    timezone = models.CharField(max_length=64)
    frame_hash = models.CharField(max_length=64)
    population = models.PositiveIntegerField()
    quota = models.PositiveIntegerField()
    rules = models.JSONField()
    utc_from = models.DateTimeField()
    utc_before = models.DateTimeField()

    class Meta(LabSystemFact.Meta):
        constraints = [
            *LabSystemFact.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "local_day", "revision"], name="lab_daily_revision"
            ),
            models.UniqueConstraint(
                fields=["organization", "local_day", "frame_hash"], name="lab_daily_frame_once"
            ),
        ]


class DailyRecountSampleMember(LabSystemFact):
    sample = models.ForeignKey(DailyRecountSample, on_delete=models.PROTECT, related_name="members")
    count = models.ForeignKey(EggCountAttempt, on_delete=models.PROTECT)
    rank = models.CharField(max_length=64)
    selected = models.BooleanField()

    class Meta(LabSystemFact.Meta):
        constraints = [
            *LabSystemFact.Meta.constraints,
            models.UniqueConstraint(fields=["sample", "count"], name="lab_sample_member_once"),
        ]


# Register concrete independent facts after their shared bases and original owners.
from lab.independent_qa.models import (  # noqa: E402, I001 -- register same-app models after their shared bases.
    EggPaddle as EggPaddle,
    LabBlindObservation as LabBlindObservation,
    LabNumericDisclosure as LabNumericDisclosure,
    LabQAPolicyVersion as LabQAPolicyVersion,
    PaddleBagBinding as PaddleBagBinding,
    PaddleReuse as PaddleReuse,
    RecountAttempt as RecountAttempt,
    RecountClaim as RecountClaim,
    RecountIndependenceAttestation as RecountIndependenceAttestation,
    RecountResolution as RecountResolution,
    RecountRevision as RecountRevision,
)

from lab.samples.models import WolbachiaSample as WolbachiaSample  # noqa: E402

from lab.shipments.models import (  # noqa: E402, I001 -- register same-app shipment facts after shared bases.
    DeliveryReceipt as DeliveryReceipt,
    MaterialRequest as MaterialRequest,
    MaterialRequestVoid as MaterialRequestVoid,
    NotificationEvidence as NotificationEvidence,
    ShipmentSource as ShipmentSource,
    ShipmentVoid as ShipmentVoid,
    UiebShipment as UiebShipment,
)
