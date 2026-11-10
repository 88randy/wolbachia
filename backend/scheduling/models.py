"""Insert-only planning facts; supersession never rewrites an offline assignment."""

from datetime import datetime
from typing import ClassVar
from uuid import UUID

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class PlanningRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True


class RiskImportUpload(PlanningRecord):
    sha256 = models.CharField(max_length=64)
    size = models.PositiveIntegerField()
    filename = models.CharField(max_length=100)
    content = models.BinaryField()


class RiskImport(PlanningRecord):
    upload = models.ForeignKey(RiskImportUpload, on_delete=models.PROTECT, related_name="+")
    file_hash = models.CharField(max_length=64)
    preview_rows = models.JSONField()
    errors = models.JSONField()
    source = models.CharField(
        max_length=20, choices=[(s, s) for s in ("official_import", "company_rule")]
    )
    week_start = models.DateField()
    revision = models.PositiveIntegerField(default=1)
    week_policy = models.JSONField()

    @property
    def applied_at(self) -> datetime | None:
        application = RiskImportApplication.objects.filter(risk_import=self).first()
        return application.created_at if application else None


class RiskImportApplication(PlanningRecord):
    risk_import = models.OneToOneField(
        RiskImport, on_delete=models.PROTECT, related_name="application"
    )


class RiskCategoryVersion(PlanningRecord):
    block = models.ForeignKey(
        "geography.Block", on_delete=models.PROTECT, related_name="risk_versions"
    )
    week_start = models.DateField()
    category = models.CharField(max_length=6, choices=[(s, s) for s in ("low", "medium", "high")])
    origin = models.ForeignKey(
        RiskImport, on_delete=models.PROTECT, related_name="category_versions"
    )
    source = models.CharField(max_length=20)
    protocol = models.CharField(max_length=80, blank=True)
    version = models.PositiveIntegerField()
    scope_center_lookup: ClassVar[str] = "block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "block__quadrant_id"

    class Meta(PlanningRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["block", "week_start", "version"], name="scheduling_risk_version"
            ),
            models.UniqueConstraint(
                fields=["origin", "block"], name="scheduling_import_block_once"
            ),
            models.CheckConstraint(
                condition=models.Q(category__in=["low", "medium", "high"]),
                name="scheduling_risk_category",
            ),
            models.CheckConstraint(
                condition=models.Q(source__in=["official_import", "company_rule"]),
                name="scheduling_risk_source",
            ),
        ]


class AssignmentVersion(PlanningRecord):
    quadrant = models.ForeignKey(
        "geography.Quadrant", on_delete=models.PROTECT, related_name="assignment_versions"
    )
    courier = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="+", null=True
    )
    valid_from = models.DateTimeField()
    version = models.PositiveIntegerField()
    scope_center_lookup: ClassVar[str] = "quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "quadrant_id"

    class Meta(PlanningRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["quadrant", "version"], name="scheduling_assignment_version"
            )
        ]
        indexes = [models.Index(fields=["quadrant", "valid_from"])]


class ScheduledTask(PlanningRecord):
    # Read projections supplied by selectors.task_query; never persisted or writable.
    courier_id: UUID | None
    owner_revision: int
    source: str | None
    origin: UUID | None
    protocol: str | None
    risk_category: str | None
    is_completed: bool

    point = models.ForeignKey(
        "geography.SamplingPoint", on_delete=models.PROTECT, related_name="scheduled_tasks"
    )
    action = models.CharField(
        max_length=7, choices=[("place", "place"), ("check", "check"), ("release", "release")]
    )
    due_date = models.DateField()
    rule_version_ids = models.JSONField(default=dict)
    scope_center_lookup: ClassVar[str] = "point__block__quadrant__center_id"
    scope_quadrant_lookup: ClassVar[str] = "point__block__quadrant_id"

    class Meta(PlanningRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "point", "action", "due_date"],
                name="scheduling_task_identity",
            ),
            models.CheckConstraint(
                condition=models.Q(action__in=["place", "check", "release"]),
                name="scheduling_task_action",
            ),
        ]

    @property
    def code(self) -> str:
        return f"{self.point.code}:{self.action}:{self.due_date.isoformat()}"


class TaskOwnership(PlanningRecord):
    task = models.ForeignKey(ScheduledTask, on_delete=models.PROTECT, related_name="ownerships")
    courier = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    revision = models.PositiveIntegerField()
    assignment_version = models.ForeignKey(
        AssignmentVersion, on_delete=models.PROTECT, related_name="+", null=True
    )

    class Meta(PlanningRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["task", "revision"], name="scheduling_task_owner_revision"
            )
        ]


class ScheduleRevision(PlanningRecord):
    """Organization-wide optimistic token, appended under the organization lock."""

    revision = models.PositiveIntegerField()
    operation = models.CharField(max_length=20)

    class Meta(PlanningRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "revision"], name="scheduling_org_revision"
            )
        ]
