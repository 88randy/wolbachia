"""Immutable incident identities, decisions and durable B-07 publication facts."""

from django.db import models

from core.models import ImmutableMixin, OrgScopedModel


class IncidentRecord(ImmutableMixin, OrgScopedModel):
    class Meta(ImmutableMixin.Meta):
        abstract = True


class Severity(models.TextChoices):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentTypeVersion(IncidentRecord):
    item = models.ForeignKey(
        "catalogs.CatalogItem", on_delete=models.PROTECT, related_name="incident_versions"
    )
    revision = models.PositiveIntegerField()
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=200)
    icon = models.CharField(max_length=64, blank=True)
    is_other = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    severity = models.CharField(max_length=8, choices=Severity.choices)
    supervisor = models.ForeignKey(
        "organizations.Membership", null=True, on_delete=models.PROTECT, related_name="+"
    )
    coordinator = models.ForeignKey(
        "organizations.Membership", null=True, on_delete=models.PROTECT, related_name="+"
    )
    terminal = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    supervisor_sla_seconds = models.PositiveIntegerField()
    coordinator_sla_seconds = models.PositiveIntegerField()
    report_evidence_min = models.PositiveSmallIntegerField(default=0)
    close_evidence_min = models.PositiveSmallIntegerField(default=1)
    blocker_kinds = models.JSONField(default=list)

    class Meta(IncidentRecord.Meta):
        constraints = [
            models.UniqueConstraint(fields=["item", "revision"], name="incident_type_revision"),
            models.CheckConstraint(
                condition=models.Q(
                    supervisor_sla_seconds__gt=0,
                    coordinator_sla_seconds__gt=0,
                    report_evidence_min__lte=100,
                    close_evidence_min__gte=1,
                    close_evidence_min__lte=100,
                ),
                name="incident_type_limits",
            ),
            models.CheckConstraint(
                condition=~models.Q(is_other=True, is_active=False), name="incident_other_active"
            ),
        ]


class Incident(IncidentRecord):
    sequence = models.PositiveBigIntegerField()
    code = models.CharField(max_length=30)
    type_version = models.ForeignKey(
        IncidentTypeVersion, on_delete=models.PROTECT, related_name="incidents"
    )
    center = models.ForeignKey("organizations.Center", on_delete=models.PROTECT, related_name="+")
    quadrant = models.ForeignKey(
        "geography.Quadrant", null=True, on_delete=models.PROTECT, related_name="+"
    )
    source_event = models.OneToOneField(
        "field_sync.FieldEvent", null=True, on_delete=models.PROTECT, related_name="incident"
    )
    device_time = models.DateTimeField()
    server_received_at = models.DateTimeField()
    description = models.TextField()

    class Meta(IncidentRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sequence"], name="incident_org_sequence"
            ),
            models.UniqueConstraint(fields=["organization", "code"], name="incident_org_code"),
        ]


class SystemRecord(IncidentRecord):
    actor_kind = models.CharField(max_length=6, choices=[("human", "human"), ("system", "system")])
    policy_version = models.CharField(max_length=40, default="incidents.v1")

    class Meta(IncidentRecord.Meta):
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(actor_kind="human", created_by__isnull=False)
                    | models.Q(actor_kind="system", created_by__isnull=True)
                ),
                name="%(app_label)s_%(class)s_actor",
            )
        ]


class AutomaticIncidentOrigin(SystemRecord):
    """A closed, stable automatic source; never a counterfeit FieldEvent."""

    incident = models.OneToOneField(
        Incident, on_delete=models.PROTECT, related_name="automatic_origin"
    )
    source_kind = models.CharField(
        max_length=24, choices=[("inventory_condition", "inventory_condition")]
    )
    source_id = models.UUIDField()
    content_hash = models.CharField(max_length=64)

    class Meta(SystemRecord.Meta):
        constraints = [
            *SystemRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["organization", "source_kind", "source_id"],
                name="automatic_incident_source",
            ),
            models.CheckConstraint(
                condition=models.Q(actor_kind="system", created_by__isnull=True),
                name="automatic_incident_system",
            ),
        ]


class IncidentEvent(SystemRecord):
    incident = models.ForeignKey(Incident, on_delete=models.PROTECT, related_name="events")
    revision = models.PositiveIntegerField()
    action = models.CharField(
        max_length=20,
        choices=[
            (value, value)
            for value in (
                "report",
                "comment",
                "reassign",
                "change_severity",
                "close",
                "void",
                "escalate",
                "reminder",
            )
        ],
    )
    state = models.CharField(
        max_length=6, choices=[("open", "open"), ("closed", "closed"), ("voided", "voided")]
    )
    owner = models.ForeignKey(
        "organizations.Membership", on_delete=models.PROTECT, related_name="+"
    )
    stage = models.PositiveSmallIntegerField()
    severity = models.CharField(max_length=8, choices=Severity.choices)
    stage_entered_at = models.DateTimeField()
    deadline = models.DateTimeField(null=True)
    last_reminder_at = models.DateTimeField()
    text = models.TextField(blank=True)
    evidence_ids = models.JSONField(default=list)
    resolved_blocker_ids = models.JSONField(default=list)

    class Meta(SystemRecord.Meta):
        ordering = ["revision"]
        constraints = [
            *SystemRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["incident", "revision"], name="incident_event_revision"
            ),
            models.CheckConstraint(condition=models.Q(stage__lte=2), name="incident_finite_stage"),
        ]


class IncidentBlocker(IncidentRecord):
    incident = models.ForeignKey(Incident, on_delete=models.PROTECT, related_name="blockers")
    resource_kind = models.CharField(max_length=20)
    resource_id = models.UUIDField()
    kind = models.CharField(max_length=30)

    class Meta(IncidentRecord.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["incident", "resource_kind", "resource_id", "kind"],
                name="incident_owned_blocker",
            )
        ]


class IncidentOrigin(IncidentRecord):
    incident = models.OneToOneField(Incident, on_delete=models.PROTECT, related_name="origin")
    marker = models.OneToOneField(
        "ovitraps.OvitrapIncidentLink", on_delete=models.PROTECT, related_name="incident_origin"
    )


class EscalationReceipt(SystemRecord):
    incident = models.ForeignKey(Incident, on_delete=models.PROTECT, related_name="escalations")
    event = models.OneToOneField(
        IncidentEvent, on_delete=models.PROTECT, related_name="escalation_receipt"
    )
    stage = models.PositiveSmallIntegerField()
    deadline = models.DateTimeField()
    hour_bucket = models.DateTimeField(null=True)

    class Meta(SystemRecord.Meta):
        constraints = [
            *SystemRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["incident", "stage", "deadline"], name="incident_escalation_due"
            ),
            models.UniqueConstraint(
                fields=["incident", "hour_bucket"],
                condition=models.Q(hour_bucket__isnull=False),
                name="incident_reminder_hour",
            ),
        ]


class NoticePublicationReceipt(SystemRecord):
    cause_kind = models.CharField(max_length=20)
    cause_id = models.UUIDField()

    class Meta(SystemRecord.Meta):
        constraints = [
            *SystemRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["cause_kind", "cause_id"], name="incident_publication_cause"
            ),
        ]


class IncidentNoticeIntent(SystemRecord):
    publication = models.ForeignKey(
        NoticePublicationReceipt, on_delete=models.PROTECT, related_name="intents"
    )
    recipient = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    kind = models.CharField(max_length=40)
    params = models.JSONField(default=dict)

    class Meta(SystemRecord.Meta):
        constraints = [
            *SystemRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["publication", "recipient", "kind"], name="incident_notice_recipient"
            ),
        ]
