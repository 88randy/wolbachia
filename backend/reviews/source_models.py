"""Immutable observations and causal identity; none of these rows dispatches work."""

from django.db import models

from reviews.base import ReviewAudit
from reviews.source_identity import SOURCE_POLICY_VERSION


class ReviewSourceSnapshot(ReviewAudit):
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_source_snapshot"
    )
    policy_version = models.CharField(max_length=40, default=SOURCE_POLICY_VERSION)
    original_envelope = models.JSONField()
    sent_at = models.DateTimeField()
    observed_session_id = models.UUIDField(null=True)
    observed_pair_id = models.UUIDField(null=True)
    ingestion_authority = models.JSONField(default=dict)
    facts = models.JSONField(default=dict)
    resource_kind = models.CharField(max_length=24, blank=True)
    resource_id = models.UUIDField(null=True)
    has_severe_observation = models.BooleanField(default=False)

    class Meta(ReviewAudit.Meta):
        indexes = [models.Index(fields=["organization", "resource_kind", "resource_id"])]


class ReviewSubjectScope(ReviewAudit):
    source_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_subject_scopes"
    )
    revision = models.PositiveIntegerField()
    is_resolved = models.BooleanField()
    contexts = models.JSONField(default=list)
    proof = models.JSONField(default=dict)

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.UniqueConstraint(
                fields=["source_event", "revision"], name="review_subject_revision"
            ),
        ]


class ReviewParentClaim(ReviewAudit):
    source_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_parent_claims"
    )
    kind = models.CharField(max_length=12, choices=[("shift", "shift"), ("ovitrap", "ovitrap")])
    identity = models.UUIDField()
    facts = models.JSONField(default=dict)

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.UniqueConstraint(
                fields=["identity"],
                condition=models.Q(kind="shift"),
                name="review_shift_parent_identity",
            ),
            models.UniqueConstraint(
                fields=["organization", "identity"],
                condition=models.Q(kind="ovitrap"),
                name="review_physical_parent_identity",
            ),
        ]


class ReviewDependency(ReviewAudit):
    source_event = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="review_dependencies"
    )
    kind = models.CharField(max_length=16)
    declared_id = models.UUIDField()
    candidate_source_id = models.UUIDField(null=True)
    candidate_envelope = models.JSONField(default=dict)

    class Meta(ReviewAudit.Meta):
        constraints = [
            *ReviewAudit.Meta.constraints,
            models.UniqueConstraint(
                fields=["source_event", "kind", "declared_id"], name="review_dependency_identity"
            ),
        ]


class ReviewDependencyResolution(ReviewAudit):
    dependency = models.OneToOneField(
        ReviewDependency, on_delete=models.PROTECT, related_name="resolution"
    )
    parent_source = models.ForeignKey(
        "field_sync.FieldEvent", on_delete=models.PROTECT, related_name="+"
    )
    parent_effect_receipt = models.ForeignKey(
        "reviews.ReviewEffectReceipt", null=True, on_delete=models.PROTECT, related_name="+"
    )
    proof = models.JSONField(default=dict)
