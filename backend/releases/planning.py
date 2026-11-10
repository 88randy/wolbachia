"""Explicit release tasks reuse the existing planner and assignment producer."""

from datetime import datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.http import Http404

from geography.geometry import contains_point
from geography.models import PointVersion, SamplingPoint
from organizations.models import Membership
from organizations.services import effective_scope
from people.transactions import people_transaction
from releases.exceptions import ReleaseConflictError
from releases.models import Permit, Release, ReleaseSchedule
from releases.permissions import PERMIT_MANAGE, authorized_quadrant
from releases.selectors import (
    current_permit_version,
    permit_blockers,
    permit_revision,
    scoped_permits,
)
from scheduling.courier_feed import append_task_changes, task_feed_rows
from scheduling.models import ScheduledTask, ScheduleRevision, TaskOwnership
from scheduling.selectors import schedule_revision
from uploads.access import UploadActor


def schedule_release(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> dict[str, Any]:
    if not scoped_permits(actor, "schedule.manage").filter(pk=identifier).exists():
        raise Http404
    with people_transaction(actor, (values["courier_id"],)):
        permit = (
            scoped_permits(actor, "schedule.manage")
            .select_for_update(nowait=True, no_key=True, of=("self",))
            .filter(pk=identifier)
            .first()
        )
        if permit is None:
            raise Http404
        authorized_quadrant(actor, permit.quadrant_id, PERMIT_MANAGE)
        point, courier, version = _planning_inputs(actor, permit, values)
        if permit_revision(permit) != values["expected_revision"]:
            raise ReleaseConflictError("permit_revision_conflict")
        if permit_blockers(permit):
            raise ReleaseConflictError("release_schedule_blocked")
        task, created = ScheduledTask.objects.get_or_create(
            organization=actor.organization,
            point=point,
            action="release",
            due_date=values["due_date"],
            defaults={"created_by": actor.user, "rule_version_ids": {}},
        )
        if created:
            ReleaseSchedule.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                task=task,
                permit_version=version,
            )
            TaskOwnership.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                task=task,
                courier=courier.user,
                revision=1,
            )
            ScheduleRevision.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                revision=schedule_revision(actor.organization) + 1,
                operation="release_plan",
            )
            _publish(actor, task, courier.user_id)
        else:
            binding = ReleaseSchedule.objects.filter(
                organization=actor.organization, task=task, permit_version=version
            ).first()
            owner = task.ownerships.order_by("-revision").first()
            if binding is None or owner is None or owner.courier_id != courier.user_id:
                raise ReleaseConflictError("release_schedule_conflict")
        return {
            "task_id": task.pk,
            "permit_version_id": version.pk,
            "due_date": task.due_date,
            "courier_id": courier.user_id,
        }


def _planning_inputs(
    actor: UploadActor, permit: Permit, values: dict[str, Any]
) -> tuple[Any, Any, Any]:
    point = SamplingPoint.objects.filter(
        organization=actor.organization,
        pk=values["point_id"],
        block__quadrant_id=permit.quadrant_id,
    ).first()
    courier = (
        Membership.objects.filter(
            organization=actor.organization,
            user_id=values["courier_id"],
            is_active=True,
            user__is_active=True,
        )
        .select_related("user")
        .first()
    )
    if (
        point is None
        or courier is None
        or not all(
            effective_scope(courier).allows(
                permission, str(permit.center_id), str(permit.quadrant_id)
            )
            for permission in ("field_event.sync", "field.bootstrap")
        )
    ):
        raise Http404
    version = current_permit_version(permit)
    instant = datetime.combine(values["due_date"], time.min, ZoneInfo(actor.organization.timezone))
    location = (
        PointVersion.objects.filter(
            organization=actor.organization, point=point, effective_from__lte=instant
        )
        .order_by("-effective_from", "-version")
        .first()
    )
    if (
        version is None
        or location is None
        or location.is_retired
        or not contains_point(version.geometry, location.location)
        or not (version.valid_from < instant + timedelta(days=1) and version.valid_to > instant)
    ):
        raise ReleaseConflictError("release_schedule_blocked")
    return point, courier, version


def _publish(actor: UploadActor, task: ScheduledTask, courier_id: UUID) -> None:
    from accounts.models import User
    from field_sync.envelope import CourierContext

    member = Membership.objects.get(
        organization=actor.organization, user=actor.user, is_active=True
    )
    rows = task_feed_rows(member, [task], "schedule.manage")
    append_task_changes(
        {courier_id: CourierContext(actor.organization, User.objects.get(pk=courier_id))}, rows
    )


def publish_release_completion(actor: UploadActor, release: Release) -> None:
    from field_sync.envelope import CourierContext

    member = Membership.objects.get(
        organization=actor.organization, user=actor.user, is_active=True
    )
    permit = release.permit_version.permit
    if not effective_scope(member).allows(
        "field.bootstrap", str(permit.center_id), str(permit.quadrant_id)
    ):
        return
    rows = task_feed_rows(member, [release.schedule_task], "field_event.sync")
    append_task_changes({actor.user.pk: CourierContext(actor.organization, actor.user)}, rows)
