"""Scheduling projections and atomic courier feed writes; no device or external I/O."""

from collections.abc import Iterable
from datetime import date
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework import serializers

from accounts.models import Device, User
from core.snapshots import snapshot_hash
from field_sync.envelope import BatchContext
from field_sync.producers import ProducerContext
from field_sync.services import ChangeInput, append_courier_change, lock_courier_batches
from organizations.models import Membership, Organization
from scheduling.csv_import import SOURCES
from scheduling.models import AssignmentVersion, ScheduledTask
from scheduling.selectors import courier_current_rows, task_query, task_rows, week_start

TASK_FIELDS = (
    "code",
    "point",
    "action",
    "date",
    "category",
    "source",
    "protocol",
    "is_completed",
    "target",
)
ROW_FIELDS = ("id", "quadrant_id", "courier", "revision")
SCOPE_FIELDS = ("organization_id", "center_id", "quadrant_id")


class AssignmentProducerSerializer(serializers.Serializer[Any]):
    """Explicit discriminated payload; metadata is checked upstream and never exposed."""

    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=("quadrant_assignment", "task"))
    quadrant_id = serializers.UUIDField()
    courier = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    code = serializers.CharField(required=False)
    point = serializers.UUIDField(required=False)
    action = serializers.ChoiceField(choices=("place", "check"), required=False)
    date = serializers.DateField(required=False)
    category = serializers.ChoiceField(
        choices=("low", "medium", "high"), allow_null=True, required=False
    )
    source = serializers.ChoiceField(choices=sorted(SOURCES), allow_null=True, required=False)  # type: ignore[assignment]
    protocol = serializers.CharField(
        max_length=80, allow_blank=True, allow_null=True, required=False
    )
    is_completed = serializers.BooleanField(required=False)
    target = serializers.IntegerField(min_value=1, required=False)

    def to_internal_value(self, data: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF boundary
        if isinstance(data, dict) and set(data) - set(self.fields) - set(SCOPE_FIELDS):
            raise serializers.ValidationError("Unexpected scheduling producer fields.")
        return super().to_internal_value(data)

    def to_representation(self, instance: Any) -> dict[str, Any]:  # noqa: ANN401 -- DRF boundary
        row = super().to_representation(instance)
        if row["kind"] == "quadrant_assignment":
            return {key: value for key, value in row.items() if key not in TASK_FIELDS}
        return row

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        present = set(TASK_FIELDS) & attrs.keys()
        if attrs["kind"] == "task" and present != set(TASK_FIELDS):
            raise serializers.ValidationError("Task payload requires every task field.")
        if attrs["kind"] == "quadrant_assignment" and present:
            raise serializers.ValidationError("Quadrant assignment cannot carry task fields.")
        return attrs


def build(ctx: ProducerContext) -> list[dict[str, Any]]:
    """Build only this active courier's current-week tasks and quadrant allocations."""
    member = (
        Membership.objects.select_related("organization", "user")
        .filter(
            organization=ctx.organization,
            user=ctx.user,
            is_active=True,
            user__is_active=True,
            organization__is_active=True,
        )
        .first()
    )
    if member is None:
        return []
    day = ctx.now.astimezone(ZoneInfo(ctx.organization.timezone)).date()
    rows = courier_current_rows(member, day, ctx)
    return [*rows["assignments"], *(task_payload(row) for row in rows["tasks"])]


def assignment_payload(assignment: AssignmentVersion) -> dict[str, Any]:
    """A quadrant has one stable phone identity across immutable assignment versions."""
    return {
        "id": str(assignment.quadrant_id),
        "kind": "quadrant_assignment",
        "organization_id": str(assignment.organization_id),
        "center_id": str(assignment.quadrant.center_id),
        "quadrant_id": str(assignment.quadrant_id),
        "courier": str(assignment.courier_id) if assignment.courier_id else None,
        "revision": assignment.version,
    }


def task_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {"kind": "task", **{key: row[key] for key in (*ROW_FIELDS, *TASK_FIELDS, *SCOPE_FIELDS)}}


def _courier_batch(organization: Organization, user: User) -> BatchContext:
    # These producer APIs read only organization/user. A planning write has no sending
    # device: never invent one or acquire account/device locks beneath the planning lock.
    now = timezone.now()
    return BatchContext(
        organization=organization,
        user=user,
        device=cast(Device, None),
        sent_at=now,
        received_at=now,
    )


def lock_couriers(
    member: Membership, identifiers: Iterable[UUID | None]
) -> dict[UUID, BatchContext]:
    """Try-lock every affected courier in UUID order before domain writes/point locks."""
    users = User.objects.filter(pk__in={identifier for identifier in identifiers if identifier})
    batches = {}
    for user in users.order_by("pk"):
        batch = _courier_batch(member.organization, user)
        lock_courier_batches(batch)
        batches[user.pk] = batch
    return batches


def _append_change(batch: BatchContext, row: dict[str, Any], action: str) -> None:
    # Content versions also change when risk provenance changes without a new owner.
    payload = {
        key: value for key, value in row.items() if key not in {"organization_id", "center_id"}
    }
    append_courier_change(
        batch,
        ChangeInput(
            kind="assignments",
            resource_type=row["kind"],
            resource_id=row["id"],
            resource_version=snapshot_hash(payload),
            scope={"center_id": row["center_id"], "quadrant_id": row["quadrant_id"]},
            action=action,
            payload=payload if action == "upsert" else {},
        ),
    )


def append_assignment_changes(
    batches: dict[UUID, BatchContext],
    assignment: AssignmentVersion,
    previous: AssignmentVersion | None,
) -> None:
    """Append allocation changes only; existing tasks keep their explicit ownership."""
    row = assignment_payload(assignment)
    if previous and previous.courier_id and previous.courier_id != assignment.courier_id:
        _append_change(batches[previous.courier_id], row, "remove")
    if assignment.courier_id:
        _append_change(batches[assignment.courier_id], row, "upsert")


def task_feed_rows(
    member: Membership, tasks: Iterable[ScheduledTask], permission: str
) -> list[dict[str, Any]]:
    """Resolve current owner/risk at each task's epi week, within the writer's scope."""
    by_week: dict[date, list[UUID]] = {}
    for task in tasks:
        by_week.setdefault(week_start(member.organization, task.due_date), []).append(task.pk)
    rows: list[dict[str, Any]] = []
    for start, identifiers in sorted(by_week.items()):
        current = task_query(member, start, permission).filter(pk__in=identifiers)
        rows.extend(task_payload(row) for row in task_rows(current, {}))
    return rows


def append_task_changes(
    batches: dict[UUID, BatchContext],
    rows: list[dict[str, Any]],
    previous: dict[str, UUID | None] | None = None,
) -> None:
    """Append a remove for a superseded owner and an upsert for each current owner."""
    for row in rows:
        courier_id = UUID(row["courier"]) if row["courier"] else None
        old_owner = previous.get(row["id"]) if previous else None
        if old_owner and old_owner != courier_id:
            _append_change(batches[old_owner], row, "remove")
        if courier_id:
            _append_change(batches[courier_id], row, "upsert")
