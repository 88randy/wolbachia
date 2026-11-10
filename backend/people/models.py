"""Immutable qualification, evaluation and truthful publication facts."""

from typing import ClassVar
from uuid import UUID

from django.conf import settings
from django.db import models
from django.db.models import Q

from core.models import ImmutableMixin, OrgScopedModel


class PeopleRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=Q(created_by__isnull=False), name="%(class)s_real_author"
            )
        ]


class ContextRecord(PeopleRecord):
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", on_delete=models.PROTECT, related_name="+", null=True
    )
    scope_center_lookup: ClassVar[str] = "center_id"
    scope_quadrant_lookup: ClassVar[str] = "quadrant_id"

    class Meta(PeopleRecord.Meta):
        abstract = True


class Training(PeopleRecord):
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=200)

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="people_training_code"),
        ]


class TrainingVersion(PeopleRecord):
    training = models.ForeignKey(Training, on_delete=models.PROTECT, related_name="versions")
    version = models.PositiveIntegerField()
    validity_seconds = models.PositiveBigIntegerField()
    enabled_actions = models.JSONField()
    effective_from = models.DateTimeField()
    is_active = models.BooleanField()

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(fields=["training", "version"], name="people_training_version"),
            models.CheckConstraint(
                condition=Q(validity_seconds__gt=0), name="people_validity_positive"
            ),
        ]


class ActionTrainingRequirementVersion(ContextRecord):
    action = models.CharField(max_length=100)
    revision = models.PositiveIntegerField()
    effective_from = models.DateTimeField()
    acceptable_versions = models.JSONField()

    class Meta(ContextRecord.Meta):
        constraints = [
            *ContextRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "action", "center", "quadrant", "revision"],
                nulls_distinct=False,
                name="people_requirement_revision",
            ),
        ]


class Certification(ContextRecord):
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    training_version = models.ForeignKey(
        TrainingVersion, on_delete=models.PROTECT, related_name="+"
    )
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    evidence_ids = models.JSONField()
    issuer_reference = models.CharField(max_length=300)
    attestation = models.TextField()
    revision = models.PositiveIntegerField(default=1)

    class Meta(ContextRecord.Meta):
        constraints = [
            *ContextRecord.Meta.constraints,
            models.CheckConstraint(
                condition=Q(valid_to__gt=models.F("valid_from")), name="people_cert_interval"
            ),
        ]


class CertificationRevocation(PeopleRecord):
    certification = models.ForeignKey(
        Certification, on_delete=models.PROTECT, related_name="revocations"
    )
    revision = models.PositiveIntegerField()
    effective_from = models.DateTimeField()
    reason_code = models.CharField(max_length=64)
    reason = models.TextField()

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["certification", "revision"], name="people_cert_revocation"
            ),
        ]


class EvaluationRubric(PeopleRecord):
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=200)

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(fields=["organization", "code"], name="people_rubric_code"),
        ]


class EvaluationRubricVersion(PeopleRecord):
    rubric = models.ForeignKey(EvaluationRubric, on_delete=models.PROTECT, related_name="versions")
    version = models.PositiveIntegerField()
    weights = models.JSONField()
    pass_threshold = models.DecimalField(max_digits=7, decimal_places=4)
    critical_checks = models.JSONField()
    effective_from = models.DateTimeField()

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(fields=["rubric", "version"], name="people_rubric_version"),
            models.CheckConstraint(
                condition=Q(pass_threshold__gte=0, pass_threshold__lte=100),
                name="people_threshold_range",
            ),
        ]


class Evaluation(ContextRecord):
    _current_attempt_id: UUID
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    rubric_version = models.ForeignKey(
        EvaluationRubricVersion, on_delete=models.PROTECT, related_name="+"
    )


class EvaluationAttempt(PeopleRecord):
    evaluation = models.ForeignKey(Evaluation, on_delete=models.PROTECT, related_name="attempts")
    predecessor = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, related_name="successor"
    )
    revision = models.PositiveIntegerField()
    observed_at = models.DateTimeField()
    section_scores = models.JSONField()
    critical_responses = models.JSONField()
    score = models.DecimalField(max_digits=11, decimal_places=8, null=True)
    outcome = models.CharField(
        max_length=20,
        choices=[(key, key) for key in ("incomplete", "pass", "low", "critical_failure")],
    )
    reason_code = models.CharField(max_length=64, blank=True, default="")
    reason = models.TextField(blank=True, default="")

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["evaluation", "revision"], name="people_attempt_revision"
            ),
            models.CheckConstraint(
                condition=Q(outcome="incomplete", score__isnull=True)
                | (
                    Q(outcome__in=["pass", "low", "critical_failure"], score__gte=0, score__lte=100)
                ),
                name="people_attempt_score",
            ),
        ]


class EvaluationVoid(PeopleRecord):
    evaluation = models.OneToOneField(
        Evaluation, on_delete=models.PROTECT, related_name="void_record"
    )
    attempt = models.OneToOneField(
        EvaluationAttempt, on_delete=models.PROTECT, related_name="void_record"
    )
    revision = models.PositiveIntegerField()
    reason_code = models.CharField(max_length=64)
    reason = models.TextField()


class EvaluationCompletion(PeopleRecord):
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    sequence = models.PositiveBigIntegerField()
    attempt = models.OneToOneField(
        EvaluationAttempt, on_delete=models.PROTECT, related_name="completion"
    )

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "subject", "sequence"], name="people_completion_sequence"
            ),
        ]


class EvaluationNoticePolicyVersion(ContextRecord):
    recipient_membership = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    revision = models.PositiveIntegerField()

    class Meta(ContextRecord.Meta):
        constraints = [
            *ContextRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "center", "quadrant", "revision"],
                nulls_distinct=False,
                name="people_notice_policy_revision",
            ),
        ]


class TrainingNoticeCause(ImmutableMixin, OrgScopedModel):
    kind = models.CharField(
        max_length=32,
        choices=[
            ("third_adverse", "third_adverse"),
            ("certification_expired", "certification_expired"),
        ],
    )
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    episode_start = models.ForeignKey(
        EvaluationCompletion, on_delete=models.PROTECT, null=True, related_name="+"
    )
    completion = models.OneToOneField(
        EvaluationCompletion, on_delete=models.PROTECT, null=True, related_name="notice_cause"
    )
    certification = models.OneToOneField(
        Certification, on_delete=models.PROTECT, null=True, related_name="expiry_cause"
    )
    due_at = models.DateTimeField()
    contexts = models.JSONField()
    policy_ids = models.JSONField(default=list)
    actor_kind = models.CharField(max_length=8, choices=[("human", "human"), ("system", "system")])
    policy_version = models.CharField(max_length=32, default="people.v1")

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    kind="third_adverse",
                    episode_start__isnull=False,
                    completion__isnull=False,
                    certification__isnull=True,
                )
                | Q(
                    kind="certification_expired",
                    episode_start__isnull=True,
                    completion__isnull=True,
                    certification__isnull=False,
                ),
                name="people_notice_cause_parent",
            ),
            models.UniqueConstraint(
                fields=["organization", "subject", "episode_start", "kind"],
                condition=Q(kind="third_adverse"),
                name="people_notice_episode",
            ),
            models.CheckConstraint(
                condition=Q(actor_kind="human", created_by__isnull=False)
                | Q(actor_kind="system", created_by__isnull=True, policy_version="people.v1"),
                name="people_notice_cause_actor",
            ),
        ]


class TrainingNoticeIntent(ImmutableMixin, OrgScopedModel):
    cause = models.ForeignKey(TrainingNoticeCause, on_delete=models.PROTECT, related_name="intents")
    recipient_membership = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    policy = models.ForeignKey(
        EvaluationNoticePolicyVersion, on_delete=models.PROTECT, null=True, related_name="+"
    )
    policy_ids = models.JSONField(default=list)
    reroutes = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, related_name="successor"
    )
    actor_kind = models.CharField(max_length=8, default="system")
    policy_version = models.CharField(max_length=32, default="people.v1")

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["cause", "recipient_membership"], name="people_notice_recipient"
            ),
            models.CheckConstraint(
                condition=Q(actor_kind="human", created_by__isnull=False)
                | Q(actor_kind="system", created_by__isnull=True, policy_version="people.v1"),
                name="people_notice_intent_actor",
            ),
        ]


class TrainingNoticePublication(ImmutableMixin, OrgScopedModel):
    cause = models.ForeignKey(
        TrainingNoticeCause, on_delete=models.PROTECT, related_name="publications"
    )
    intent = models.ForeignKey(
        TrainingNoticeIntent, on_delete=models.PROTECT, null=True, related_name="publications"
    )
    status = models.CharField(
        max_length=32,
        choices=[
            (key, key)
            for key in (
                "recipient_unconfigured",
                "recipient_unavailable",
                "delivery_unavailable",
                "superseded",
            )
        ],
    )
    attempt_number = models.PositiveIntegerField()
    frame_hash = models.CharField(max_length=64)
    assessment = models.JSONField()
    not_published = models.BooleanField()
    actor_kind = models.CharField(max_length=8, default="system")
    policy_version = models.CharField(max_length=32, default="people.v1")

    class Meta(ImmutableMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["cause", "attempt_number"], name="people_publication_attempt"
            ),
            models.CheckConstraint(
                condition=Q(actor_kind="human", created_by__isnull=False)
                | Q(actor_kind="system", created_by__isnull=True, policy_version="people.v1"),
                name="people_publication_actor",
            ),
        ]


class TrainingNoticeRoute(PeopleRecord):
    cause = models.ForeignKey(TrainingNoticeCause, on_delete=models.PROTECT, related_name="routes")
    intent = models.ForeignKey(
        TrainingNoticeIntent, on_delete=models.PROTECT, related_name="routes"
    )
    predecessor = models.OneToOneField(
        "self", on_delete=models.PROTECT, null=True, related_name="successor"
    )
    revision = models.PositiveIntegerField()
    command_id = models.UUIDField()
    policy_ids = models.JSONField()

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["cause", "revision"], name="people_notice_route_revision"
            ),
        ]


class EligibilityAssessmentReceipt(ContextRecord):
    subject = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    session = models.ForeignKey(
        "accounts.DeviceSession", on_delete=models.PROTECT, related_name="+"
    )
    pair_id = models.UUIDField()
    action = models.CharField(max_length=100)
    semantic_hash = models.CharField(max_length=64)
    scope_revision = models.CharField(max_length=64)
    publication_sequence = models.PositiveBigIntegerField()
    assessment = models.JSONField()
    authority = models.JSONField()
    valid_from = models.DateTimeField(null=True)
    valid_until = models.DateTimeField(null=True)

    class Meta(ContextRecord.Meta):
        constraints = [
            *ContextRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=[
                    "session",
                    "action",
                    "center",
                    "quadrant",
                    "semantic_hash",
                    "scope_revision",
                ],
                nulls_distinct=False,
                name="people_assessment_frame",
            ),
        ]


class PeopleCommand(PeopleRecord):
    command_id = models.UUIDField()
    operation = models.CharField(max_length=64)
    target_id = models.UUIDField(null=True)
    body_hash = models.CharField(max_length=64)
    response = models.JSONField()
    subjects = models.JSONField()

    class Meta(PeopleRecord.Meta):
        constraints = [
            *PeopleRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "command_id"], name="people_command_identity"
            ),
        ]
