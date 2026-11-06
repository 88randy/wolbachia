"""One real next-day task/provenance under the already-held organization arbiter."""

from datetime import datetime, time
from uuid import UUID
from zoneinfo import ZoneInfo

from rest_framework.exceptions import NotFound

from field_sync.exceptions import SyncInProgressError
from field_sync.services import FanoutPublisher
from geography.decisions.models import NextDayTask
from geography.decisions.policy import next_organization_day
from organizations.models import Membership
from ovitraps.lifecycle.models import RelocationDecision, RelocationProposal
from ovitraps.permissions import RELOCATION_DECIDE
from scheduling.courier_feed import _change_input, task_feed_rows
from scheduling.models import AssignmentVersion, ScheduledTask, TaskOwnership
from scheduling.selectors import assignment_at, check_courier_scope, courier_member
from scheduling.services import _append_schedule_revision, _initial_owner


def member_for(proposal: RelocationProposal, actor_id: UUID | None) -> Membership:
    if actor_id is None:
        raise NotFound
    return Membership.objects.select_related("organization", "user").get(
        organization=proposal.organization, user_id=actor_id, is_active=True, user__is_active=True
    )


def due_assignment(
    proposal: RelocationProposal, member: Membership, instant: datetime
) -> AssignmentVersion | None:
    quadrant = proposal.ovitrap.sampling_point.block.quadrant
    day = next_organization_day(instant, proposal.organization.timezone)
    at = datetime.combine(day, time.min, ZoneInfo(proposal.organization.timezone))
    assignment = assignment_at(quadrant, at)
    if assignment is None or assignment.courier_id is None:
        return None
    try:
        check_courier_scope(courier_member(member, assignment.courier_id), quadrant)
    except NotFound:
        return None
    return assignment


def anticipated_owner(
    proposal: RelocationProposal, member: Membership, instant: datetime
) -> UUID | None:
    task = ScheduledTask.objects.filter(
        organization=proposal.organization,
        point_id=proposal.ovitrap.sampling_point_id,
        action="check",
        due_date=next_organization_day(instant, proposal.organization.timezone),
    ).first()
    if task is not None:
        return (
            TaskOwnership.objects.filter(task=task)
            .order_by("-revision")
            .values_list("courier_id", flat=True)
            .first()
        )
    assignment = due_assignment(proposal, member, instant)
    return None if assignment is None else assignment.courier_id


def rejection_task(
    decision: RelocationDecision, instant: datetime, owner: UUID | None
) -> tuple[NextDayTask, bool]:
    proposal = decision.proposal
    member = member_for(proposal, decision.created_by_id)
    if anticipated_owner(proposal, member, instant) != owner:
        raise SyncInProgressError
    task, created = ScheduledTask.objects.get_or_create(
        organization=proposal.organization,
        point=proposal.ovitrap.sampling_point,
        action="check",
        due_date=next_organization_day(instant, proposal.organization.timezone),
        defaults={"created_by": member.user, "rule_version_ids": dict(proposal.rule_version_ids)},
    )
    ScheduledTask.objects.select_for_update(nowait=True, no_key=True).get(pk=task.pk)
    if created:
        _initial_owner(task, member, due_assignment(proposal, member, instant))
        _append_schedule_revision(member, "relocation_reject")
    origin = NextDayTask.objects.create(
        organization=proposal.organization,
        created_by=member.user,
        proposal=proposal,
        decision=decision,
        task=task,
    )
    return origin, created


def publish_new_task(origin: NextDayTask, member: Membership, emit: FanoutPublisher) -> None:
    for row in task_feed_rows(member, [origin.task], RELOCATION_DECIDE):
        if row["courier"]:
            emit(_change_input(row, "upsert"), courier_id=UUID(row["courier"]))
