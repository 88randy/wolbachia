"""Atomic writers: Organization NOWAIT -> courier try-locks -> domain NOWAIT locks.

No account locks or external IO occur below this boundary. Domain facts and feed
rows commit together; point locks also serialize ovitrap completion effects.
"""

import hashlib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, cast
from uuid import UUID

from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from core.exceptions import FieldValidationError
from core.time import epi_week_label
from field_sync.exceptions import SyncInProgressError
from geography.models import Block, SamplingPoint
from geography.selectors import get_quadrant, point_version_at
from organizations.models import Membership, Organization
from organizations.selectors import filter_by_effective_scope
from organizations.services import effective_scope
from ovitraps.models import Ovitrap, OvitrapReading
from rules.models import RuleParameter
from rules.selectors import get_version_in_force
from scheduling.courier_feed import (
    append_assignment_changes,
    append_task_changes,
    lock_couriers,
    task_feed_rows,
)
from scheduling.csv_import import (
    MAX_UPLOAD_BYTES,
    SOURCES,
    InvalidCellError,
    normalized_cell,
    parse_csv,
)
from scheduling.exceptions import SchedulingBusyError, SchedulingConflictError
from scheduling.models import (
    AssignmentVersion,
    RiskCategoryVersion,
    RiskImport,
    RiskImportApplication,
    RiskImportUpload,
    ScheduledTask,
    ScheduleRevision,
    TaskOwnership,
)
from scheduling.permissions import RISK_IMPORT_APPLY, SCHEDULE_MANAGE
from scheduling.selectors import (
    DAYS_PER_WEEK,
    assignment_at,
    check_courier_scope,
    courier_member,
    local_midnight,
    schedule_revision,
    task_query,
    week_start,
)

MAX_REASSIGN_TASKS = 200


@dataclass(frozen=True)
class ImportPreview:
    upload_id: UUID
    week: date
    source: str


@dataclass(frozen=True)
class AssignmentChange:
    quadrant_id: UUID
    courier_id: UUID | None
    expected_revision: int


@dataclass(frozen=True)
class PendingReassignment:
    task_ids: tuple[UUID, ...]
    courier: UUID
    expected_revision: int


@contextmanager
def planning_lock(member: Membership, permission: str) -> Iterator[Membership]:
    try:
        with transaction.atomic():
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=member.organization_id
            )
            current = Membership.objects.select_related("organization", "user").get(
                pk=member.pk, organization_id=member.organization_id
            )
            if not effective_scope(current).allows(permission):
                raise PermissionDenied
            yield current
    except SyncInProgressError as error:
        raise SchedulingBusyError from error
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in {"55P03", "40P01"}:
            raise SchedulingBusyError from error
        raise


def _append_schedule_revision(member: Membership, operation: str) -> int:
    revision = schedule_revision(member.organization) + 1
    ScheduleRevision.objects.create(
        organization=member.organization,
        created_by=member.user,
        revision=revision,
        operation=operation,
    )
    return revision


def _check_revision(current: int, expected: int) -> None:
    if current != expected:
        raise SchedulingConflictError("stale_revision")


def store_upload(member: Membership, filename: str, content: bytes) -> RiskImportUpload:
    """Persist bounded bytes after transport limiting; no domain writes or file system storage."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise FieldValidationError("file", "file_too_large")
    try:
        name = normalized_cell(filename.replace("\\", "/").rsplit("/", 1)[-1])[:100]
    except InvalidCellError as error:
        raise FieldValidationError("file", "invalid_filename") from error
    if not name.lower().endswith(".csv"):
        raise FieldValidationError("file", "csv_required")
    with planning_lock(member, RISK_IMPORT_APPLY) as current:
        return RiskImportUpload.objects.create(
            organization=current.organization,
            created_by=current.user,
            sha256=hashlib.sha256(content).hexdigest(),
            size=len(content),
            filename=name,
            content=content,
        )


def _preview_blocks(
    member: Membership, rows: list[dict[str, str]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    blocks = filter_by_effective_scope(
        Block.objects.filter(
            organization=member.organization, code__in=[row["block_code"] for row in rows]
        ).select_related("quadrant"),
        member,
        RISK_IMPORT_APPLY,
    )
    by_code = {block.code: block for block in blocks}
    accepted, errors = [], []
    for row in rows:
        block = by_code.get(row["block_code"])
        if block is None:
            errors.append({"code": "block_inaccessible", "block_code": row["block_code"]})
            continue
        accepted.append(
            {
                **row,
                "block_id": str(block.pk),
                "quadrant_id": str(block.quadrant_id),
                "center_id": str(block.quadrant.center_id),
            }
        )
    return accepted, errors


def preview_import(member: Membership, preview: ImportPreview) -> RiskImport:
    """Append metadata only; categories and assignments are unchanged even on valid previews."""
    if preview.source not in SOURCES:
        raise FieldValidationError("source", "invalid_choice")
    upload = RiskImportUpload.objects.filter(
        organization=member.organization, pk=preview.upload_id
    ).first()
    if upload is None:
        raise NotFound
    rows, errors = parse_csv(bytes(upload.content))
    with planning_lock(member, RISK_IMPORT_APPLY) as current:
        accepted, inaccessible = _preview_blocks(current, rows)
        return RiskImport.objects.create(
            organization=current.organization,
            created_by=current.user,
            upload=upload,
            file_hash=upload.sha256,
            preview_rows=accepted,
            errors=[*errors, *inaccessible],
            source=preview.source,
            week_start=week_start(current.organization, preview.week),
            week_policy={
                "epi_week": current.organization.epi_week,
                "timezone": current.organization.timezone,
            },
        )


def _import_blocks(member: Membership, risk_import: RiskImport) -> dict[str, Block]:
    visible = filter_by_effective_scope(
        Block.objects.filter(organization=member.organization).select_related("quadrant"),
        member,
        RISK_IMPORT_APPLY,
    )
    blocks = {
        str(block.pk): block
        for block in visible.filter(pk__in=[row["block_id"] for row in risk_import.preview_rows])
    }
    if {row["block_id"] for row in risk_import.preview_rows} - blocks.keys():
        raise NotFound
    if risk_import.week_policy != {
        "epi_week": member.organization.epi_week,
        "timezone": member.organization.timezone,
    }:
        raise SchedulingConflictError("import_scope_mismatch")
    for row in risk_import.preview_rows:
        block = blocks[row["block_id"]]
        if row["quadrant_id"] != str(block.quadrant_id) or row["center_id"] != str(
            block.quadrant.center_id
        ):
            raise SchedulingConflictError("import_scope_mismatch")
    return blocks


def apply_import(
    member: Membership, identifier: UUID, expected_revision: int
) -> RiskImportApplication:
    """Replay the same application, or atomically append all accepted risk versions once."""
    with planning_lock(member, RISK_IMPORT_APPLY) as current:
        risk_import = RiskImport.objects.filter(
            organization=current.organization, pk=identifier
        ).first()
        if risk_import is None:
            raise NotFound
        blocks = _import_blocks(current, risk_import)
        application = RiskImportApplication.objects.filter(risk_import=risk_import).first()
        if application:
            return cast(RiskImportApplication, application)
        _check_revision(risk_import.revision, expected_revision)
        if risk_import.errors:
            raise SchedulingConflictError("import_has_errors")
        tasks = list(
            task_query(current, risk_import.week_start, RISK_IMPORT_APPLY)
            .filter(point__block_id__in=blocks)
            .exclude(**{"courier_id": None})
        )
        before = {row["id"]: row for row in task_feed_rows(current, tasks, RISK_IMPORT_APPLY)}
        batches = lock_couriers(current, (task.courier_id for task in tasks))
        RiskImport.objects.select_for_update(nowait=True).get(pk=risk_import.pk)
        for row in risk_import.preview_rows:
            block = blocks[row["block_id"]]
            previous = (
                RiskCategoryVersion.objects.filter(block=block, week_start=risk_import.week_start)
                .order_by("-version")
                .first()
            )
            RiskCategoryVersion.objects.create(
                organization=current.organization,
                created_by=current.user,
                block=block,
                week_start=risk_import.week_start,
                category=row["category"],
                origin=risk_import,
                source=risk_import.source,
                protocol=row["protocol"],
                version=previous.version + 1 if previous else 1,
            )
        changed = [
            row
            for row in task_feed_rows(current, tasks, RISK_IMPORT_APPLY)
            if any(row[key] != before[row["id"]][key] for key in ("category", "source", "protocol"))
        ]
        append_task_changes(batches, changed)
        _append_schedule_revision(current, "risk_import")
        return RiskImportApplication.objects.create(
            organization=current.organization, created_by=current.user, risk_import=risk_import
        )


def change_assignment(member: Membership, change: AssignmentChange) -> dict[str, Any]:
    """Append an effective quadrant assignment; old rows resolve past capture ownership."""
    with planning_lock(member, SCHEDULE_MANAGE) as current:
        quadrant = get_quadrant(current, change.quadrant_id, SCHEDULE_MANAGE)
        if change.courier_id:
            check_courier_scope(courier_member(current, change.courier_id), quadrant)
        previous = AssignmentVersion.objects.filter(quadrant=quadrant).order_by("-version").first()
        _check_revision(previous.version if previous else 0, change.expected_revision)
        batches = lock_couriers(
            current, (change.courier_id, previous.courier_id if previous else None)
        )
        assignment = AssignmentVersion.objects.create(
            organization=current.organization,
            created_by=current.user,
            quadrant=quadrant,
            courier_id=change.courier_id,
            valid_from=timezone.now(),
            version=change.expected_revision + 1,
        )
        append_assignment_changes(batches, assignment, previous)
        revision = _append_schedule_revision(current, "assignment")
        return {
            "id": str(assignment.pk),
            "quadrant": str(quadrant.pk),
            "courier": str(change.courier_id) if change.courier_id else None,
            "revision": assignment.version,
            "schedule_revision": revision,
            "valid_from": assignment.valid_from,
        }


def _due_actions(point: SamplingPoint, start: date) -> list[tuple[str, date, dict[str, str]]]:
    placement = (
        Ovitrap.objects.filter(
            organization_id=point.organization_id,
            sampling_point=point,
            event__voided_at__isnull=True,
        )
        .select_related("event")
        .order_by("-event__device_time", "-created_at")
        .first()
    )
    if placement is None:
        return [("place", start, {})]
    # Retain the first published plan even if future revisit rules change on replay.
    if ScheduledTask.objects.filter(
        organization=point.organization,
        point=point,
        action="check",
        due_date__gte=start,
        due_date__lt=start + timedelta(days=DAYS_PER_WEEK),
    ).exists():
        return []
    readings = OvitrapReading.objects.filter(ovitrap=placement, event__voided_at__isnull=True)
    if readings.filter(epi_week=epi_week_label(start, point.organization.epi_week)).exists():
        return []
    reading = (
        readings.select_related("event").order_by("-event__device_time", "-created_at").first()
    )
    last_capture = max(
        placement.event.device_time,
        reading.event.device_time if reading else placement.event.device_time,
    )
    from zoneinfo import ZoneInfo

    last_day = last_capture.astimezone(ZoneInfo(point.organization.timezone)).date()
    parameter = RuleParameter.objects.filter(
        organization=point.organization, key="revisit_interval_days"
    ).first()
    for offset in range(DAYS_PER_WEEK):
        day = start + timedelta(days=offset)
        rule = (
            get_version_in_force(parameter, local_midnight(point.organization, day))
            if parameter
            else None
        )
        if rule is None or rule.value < 1:
            raise SchedulingConflictError("revisit_rule_not_configured")
        if (day - last_day).days >= int(rule.value):
            return [("check", day, {"revisit_interval_days": str(rule.pk)})]
    return []


def _generation_assignments(
    member: Membership, points: list[SamplingPoint]
) -> dict[UUID, AssignmentVersion | None]:
    """Capture eligible initial owners before locking any points or writing tasks."""
    quadrants = {point.block.quadrant_id: point.block.quadrant for point in points}
    assignments = {}
    instant = timezone.now()
    for identifier, quadrant in quadrants.items():
        assignment = assignment_at(quadrant, instant)
        if assignment and assignment.courier_id:
            try:
                check_courier_scope(courier_member(member, assignment.courier_id), quadrant)
            except NotFound:
                assignment = None  # Lost field authority leaves generated tasks unassigned.
        assignments[identifier] = assignment
    return assignments


def _initial_owner(
    task: ScheduledTask, member: Membership, assignment: AssignmentVersion | None
) -> None:
    if assignment is None or assignment.courier_id is None:
        return
    TaskOwnership.objects.create(
        organization=member.organization,
        created_by=member.user,
        task=task,
        courier_id=assignment.courier_id,
        revision=1,
        assignment_version=assignment,
    )


def generate_schedule(member: Membership, week: date) -> dict[str, int]:
    """Materialize only missing identities, under the shared lock; a retry appends nothing."""
    with planning_lock(member, SCHEDULE_MANAGE) as current:
        start = week_start(current.organization, week)
        points = filter_by_effective_scope(
            SamplingPoint.objects.filter(organization=current.organization),
            current,
            SCHEDULE_MANAGE,
        )
        ordered_points = list(
            points.select_related("organization", "block__quadrant").order_by("pk")
        )
        assignments = _generation_assignments(current, ordered_points)
        batches = lock_couriers(
            current, (assignment.courier_id for assignment in assignments.values() if assignment)
        )
        new_tasks = []
        created = 0
        for point in ordered_points:
            SamplingPoint.objects.select_for_update(no_key=True, nowait=True).get(pk=point.pk)
            version = point_version_at(point, timezone.now())
            if version is None or version.is_retired:
                continue
            for action, due, rules in _due_actions(point, start):
                task, is_created = ScheduledTask.objects.get_or_create(
                    organization=current.organization,
                    point=point,
                    action=action,
                    due_date=due,
                    defaults={"created_by": current.user, "rule_version_ids": rules},
                )
                if is_created:
                    _initial_owner(task, current, assignments[point.block.quadrant_id])
                    new_tasks.append(task)
                    created += 1
        append_task_changes(batches, task_feed_rows(current, new_tasks, SCHEDULE_MANAGE))
        revision = (
            _append_schedule_revision(current, "generate")
            if created
            else schedule_revision(current.organization)
        )
        return {"created": created, "revision": revision}


def _pending_tasks(member: Membership, change: PendingReassignment) -> list[ScheduledTask]:
    identifiers = set(change.task_ids)
    if not identifiers or len(change.task_ids) > MAX_REASSIGN_TASKS:
        raise FieldValidationError("task_ids", "invalid_task_count")
    visible = filter_by_effective_scope(
        ScheduledTask.objects.filter(organization=member.organization, pk__in=identifiers),
        member,
        SCHEDULE_MANAGE,
    )
    tasks = list(visible.select_related("point__block__quadrant").order_by("point_id", "pk"))
    if len(tasks) != len(identifiers):
        raise NotFound
    return tasks


def _lock_task_points(tasks: list[ScheduledTask]) -> None:
    for point_id in sorted({task.point_id for task in tasks}):
        SamplingPoint.objects.select_for_update(nowait=True, no_key=True).get(pk=point_id)


def _check_pending(member: Membership, tasks: list[ScheduledTask]) -> None:
    blocked = []
    for task in tasks:
        current = task_query(
            member, week_start(member.organization, task.due_date), SCHEDULE_MANAGE
        ).get(pk=task.pk)
        if current.is_completed:
            blocked.append({"code": "task_completed", "id": str(task.pk), "task_code": task.code})
    if blocked:
        raise SchedulingConflictError("task_completed", blocked)


def reassign_pending(member: Membership, change: PendingReassignment) -> dict[str, Any]:
    """Append one owner per visible pending task; stale writers never override a winner."""
    with planning_lock(member, SCHEDULE_MANAGE) as current:
        tasks = _pending_tasks(current, change)
        courier = courier_member(current, change.courier)
        for task in tasks:
            check_courier_scope(courier, task.point.block.quadrant)
        _check_revision(schedule_revision(current.organization), change.expected_revision)
        previous_owners = {
            row["id"]: UUID(row["courier"]) if row["courier"] else None
            for row in task_feed_rows(current, tasks, SCHEDULE_MANAGE)
        }
        batches = lock_couriers(current, (change.courier, *previous_owners.values()))
        _lock_task_points(tasks)
        _check_pending(current, tasks)
        owners = []
        for task in tasks:
            previous = TaskOwnership.objects.filter(task=task).order_by("-revision").first()
            owner = TaskOwnership.objects.create(
                organization=current.organization,
                created_by=current.user,
                task=task,
                courier_id=change.courier,
                revision=previous.revision + 1 if previous else 1,
                assignment_version=assignment_at(task.point.block.quadrant, timezone.now()),
            )
            owners.append(
                {"task": str(task.pk), "courier": str(owner.courier_id), "revision": owner.revision}
            )
        append_task_changes(
            batches, task_feed_rows(current, tasks, SCHEDULE_MANAGE), previous_owners
        )
        return {"revision": _append_schedule_revision(current, "reassign"), "owners": owners}
