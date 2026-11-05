"""Scoped current and capture-time projections. GET paths never materialize tasks."""

from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import (
    Case,
    CharField,
    Count,
    Exists,
    OuterRef,
    QuerySet,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce, Concat, TruncDate
from django.utils import timezone
from rest_framework.exceptions import NotFound

from core.exceptions import FieldValidationError
from core.time import epi_week_start
from geography.models import Block, Quadrant
from geography.selectors import get_quadrant, visible_quadrants
from organizations.models import Membership, Organization
from organizations.selectors import filter_by_effective_scope
from organizations.services import effective_scope
from ovitraps.models import Ovitrap, OvitrapReading
from rules.selectors import get_values_in_force
from scheduling.models import (
    AssignmentVersion,
    RiskCategoryVersion,
    ScheduledTask,
    ScheduleRevision,
    TaskOwnership,
)
from scheduling.permissions import SCHEDULE_READ

DEFAULT_DAILY_TARGET = 40
DAYS_PER_WEEK = 7


def week_start(organization: Organization, day: date) -> date:
    """Accept a local calendar date; normalize using the shared epi-week helper."""
    return epi_week_start(day, organization.epi_week)


def local_midnight(organization: Organization, day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=ZoneInfo(organization.timezone))


def schedule_revision(organization: Organization) -> int:
    latest = (
        ScheduleRevision.objects.filter(organization=organization).order_by("-revision").first()
    )
    return latest.revision if latest else 0


def assignment_at(quadrant: Quadrant, instant: datetime) -> AssignmentVersion | None:
    """Resolve capture ownership after any number of later supersessions."""
    return (
        AssignmentVersion.objects.filter(
            organization_id=quadrant.organization_id, quadrant=quadrant, valid_from__lte=instant
        )
        .order_by("-valid_from", "-version")
        .first()
    )


def current_risks(membership: Membership, start: date) -> QuerySet[RiskCategoryVersion]:
    latest = RiskCategoryVersion.objects.filter(block=OuterRef("block"), week_start=start).order_by(
        "-version"
    )
    return cast(
        "QuerySet[RiskCategoryVersion]",
        filter_by_effective_scope(
            RiskCategoryVersion.objects.filter(
                organization=membership.organization,
                week_start=start,
                pk=Subquery(latest.values("pk")[:1]),
            ).select_related("block__quadrant"),
            membership,
            SCHEDULE_READ,
        ),
    )


def scoped_block(membership: Membership, identifier: UUID, permission: str) -> Block:
    blocks = filter_by_effective_scope(
        Block.objects.filter(organization=membership.organization).select_related(
            "quadrant__center"
        ),
        membership,
        permission,
    )
    block = blocks.filter(pk=identifier).first()
    if block is None:
        raise NotFound
    return cast(Block, block)


def courier_member(membership: Membership, identifier: UUID) -> Membership:
    courier = (
        Membership.objects.select_related("user", "organization")
        .filter(
            organization=membership.organization,
            user_id=identifier,
            is_active=True,
            user__is_active=True,
        )
        .first()
    )
    if courier is None or not effective_scope(courier).allows("field_event.sync"):
        raise NotFound
    return courier


def check_courier_scope(courier: Membership, quadrant: Quadrant) -> None:
    if not effective_scope(courier).allows(
        "field_event.sync", str(quadrant.center_id), str(quadrant.pk)
    ):
        raise NotFound


def validate_filters(membership: Membership, query: dict[str, Any], permission: str) -> None:
    if identifier := query.get("quadrant"):
        get_quadrant(membership, identifier, permission)
    if identifier := query.get("block"):
        scoped_block(membership, identifier, permission)
    if (identifier := query.get("center")) and not visible_quadrants(membership, permission).filter(
        center_id=identifier
    ).exists():
        raise NotFound
    if identifier := query.get("courier"):
        courier = courier_member(membership, identifier)
        grant = effective_scope(courier)
        if not any(
            grant.allows("field_event.sync", str(quadrant.center_id), str(quadrant.pk))
            for quadrant in visible_quadrants(membership, permission)
        ):
            raise NotFound


def task_query(
    membership: Membership, start: date, permission: str = SCHEDULE_READ
) -> QuerySet[ScheduledTask]:
    tasks = filter_by_effective_scope(
        ScheduledTask.objects.filter(
            organization=membership.organization,
            due_date__gte=start,
            due_date__lt=start + timedelta(days=DAYS_PER_WEEK),
        ),
        membership,
        permission,
    )
    owners = TaskOwnership.objects.filter(task=OuterRef("pk")).order_by("-revision")
    risk = RiskCategoryVersion.objects.filter(
        block_id=OuterRef("point__block_id"), week_start=start
    ).order_by("-version")
    capture_tz = ZoneInfo(membership.organization.timezone)
    placements = (
        Ovitrap.objects.filter(
            organization=membership.organization,
            sampling_point_id=OuterRef("point_id"),
            event__voided_at__isnull=True,
        )
        .annotate(capture_date=TruncDate("event__device_time", tzinfo=capture_tz))
        .filter(capture_date=OuterRef("due_date"))
    )
    readings = (
        OvitrapReading.objects.filter(
            organization=membership.organization,
            ovitrap__sampling_point_id=OuterRef("point_id"),
            event__voided_at__isnull=True,
        )
        .annotate(capture_date=TruncDate("event__device_time", tzinfo=capture_tz))
        .filter(capture_date=OuterRef("due_date"))
    )
    annotated = (
        tasks.select_related("organization", "point__block__quadrant")
        .annotate(
            task_code=Concat(
                "point__code", Value(":"), "action", Value(":"), Cast("due_date", CharField())
            ),
            courier_id=Subquery(owners.values("courier_id")[:1]),
            owner_revision=Coalesce(Subquery(owners.values("revision")[:1]), Value(0)),
            source=Subquery(risk.values("source")[:1]),
            origin=Subquery(risk.values("origin_id")[:1]),
            protocol=Subquery(risk.values("protocol")[:1]),
            risk_category=Subquery(risk.values("category")[:1]),
            is_completed=Case(
                When(action="place", then=Exists(placements)), default=Exists(readings)
            ),
        )
        .annotate(
            risk_rank=Case(
                When(risk_category="high", then=Value(3)),
                When(risk_category="medium", then=Value(2)),
                When(risk_category="low", then=Value(1)),
                default=Value(0),
            )
        )
    )
    return cast(
        "QuerySet[ScheduledTask]",
        annotated.order_by("-risk_rank", "due_date", "point__code", "action", "id"),
    )


def filtered_tasks(
    membership: Membership, query: dict[str, Any], permission: str = SCHEDULE_READ
) -> QuerySet[ScheduledTask]:
    validate_filters(membership, query, permission)
    start = week_start(membership.organization, query["week"])
    tasks = task_query(membership, start, permission)
    if day := query.get("day"):
        if week_start(membership.organization, day) != start:
            raise FieldValidationError("day", "outside_week")
        tasks = tasks.filter(due_date=day)
    paths = {
        "courier": "courier_id",
        "quadrant": "point__block__quadrant_id",
        "code": "task_code",
    }
    for key, path in paths.items():
        if query.get(key) is not None:
            tasks = tasks.filter(**{path: query[key]})
    return tasks


def daily_target(organization: Organization, day: date) -> int:
    value = get_values_in_force(organization, local_midnight(organization, day)).get(
        "daily_task_target"
    )
    return DEFAULT_DAILY_TARGET if value is None else int(value)


def task_loads(tasks: QuerySet[ScheduledTask]) -> dict[str | None, int]:
    annotated = cast("QuerySet[Any]", tasks)
    rows = (
        annotated.filter(is_completed=False)
        .order_by()
        .values("courier_id")
        .annotate(load=Count("id"))
    )
    return {str(row["courier_id"]) if row["courier_id"] else None: row["load"] for row in rows}


def task_rows(tasks: Iterable[ScheduledTask], loads: dict[str | None, int]) -> list[dict[str, Any]]:
    rows = []
    for task in tasks:
        courier = str(task.courier_id) if task.courier_id else None
        rows.append(
            {
                "id": str(task.pk),
                "code": task.code,
                "point": str(task.point_id),
                "organization_id": str(task.organization_id),
                "center_id": str(task.point.center_id),
                "quadrant_id": str(task.point.quadrant_id),
                "action": task.action,
                "date": task.due_date.isoformat(),
                "courier": courier,
                "revision": task.owner_revision,
                "load": loads.get(courier, 0),
                "target": daily_target(task.organization, task.due_date),
                "source": task.source,
                "origin": str(task.origin) if task.origin else None,
                "protocol": task.protocol,
                "category": task.risk_category,
                "is_completed": task.is_completed,
                "blockers": [] if courier else [{"code": "unassigned"}],
            }
        )
    return rows


def assignment_rows(membership: Membership, query: dict[str, Any]) -> list[dict[str, Any]]:
    validate_filters(membership, query, SCHEDULE_READ)
    quadrants = visible_quadrants(membership, SCHEDULE_READ).order_by("code", "pk")
    for key, path in {"quadrant": "pk", "center": "center_id", "code": "code"}.items():
        if query.get(key) is not None:
            quadrants = quadrants.filter(**{path: query[key]})
    instant = timezone.now()
    day = instant.astimezone(ZoneInfo(membership.organization.timezone)).date()
    loads = task_loads(task_query(membership, week_start(membership.organization, day)))
    rows = []
    for quadrant in quadrants:
        assignment = assignment_at(quadrant, instant)
        courier = str(assignment.courier_id) if assignment and assignment.courier_id else None
        if query.get("courier") and courier != str(query["courier"]):
            continue
        rows.append(
            {
                "quadrant": str(quadrant.pk),
                "code": quadrant.code,
                "center_id": str(quadrant.center_id),
                "courier": courier,
                "revision": assignment.version if assignment else 0,
                "assignment_version": str(assignment.pk) if assignment else None,
                "load": loads.get(courier, 0),
                "target": daily_target(membership.organization, day),
                "blockers": [] if courier else [{"code": "unassigned"}],
            }
        )
    return rows


def courier_current_rows(courier: Membership, start: date) -> dict[str, list[dict[str, Any]]]:
    """B-13 integration seam: plain rows, authorized with courier field scope, no producer imports."""
    tasks = cast(
        "QuerySet[Any]",
        task_query(courier, week_start(courier.organization, start), "field_event.sync"),
    ).filter(courier_id=courier.user_id)
    assignments = []
    for quadrant in visible_quadrants(courier, "field_event.sync"):
        assignment = assignment_at(quadrant, timezone.now())
        if assignment and assignment.courier_id == courier.user_id:
            assignments.append(
                {
                    "id": str(assignment.pk),
                    "organization_id": str(courier.organization_id),
                    "center_id": str(quadrant.center_id),
                    "quadrant_id": str(quadrant.pk),
                    "revision": assignment.version,
                    "courier": str(courier.user_id),
                }
            )
    return {"assignments": assignments, "tasks": task_rows(tasks, task_loads(tasks))}
