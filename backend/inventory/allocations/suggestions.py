"""Read-only real due-task projection, with explicit authored material mappings."""

from datetime import date
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from django.db.models import OuterRef, QuerySet, Subquery
from django.http import Http404

from inventory.allocations.models import SupplyMaterialMappingVersion
from inventory.allocations.permissions import ALLOCATE
from inventory.allocations.scope import authorized_center_contexts, require_contexts
from inventory.transfers.policy import json_facts
from organizations.models import Membership
from scheduling.selectors import schedule_revision, task_query, week_start
from uploads.access import UploadActor, current_scope


def material_suggestion(
    actor: UploadActor, day: date, courier_id: UUID | None = None
) -> dict[str, Any]:
    """No task generation, stock guess, grant escalation, or daily-target multiplication."""
    courier_id = actor.user.pk if courier_id is None else courier_id
    caller = Membership.objects.filter(
        organization=actor.organization, user=actor.user, is_active=True
    ).first()
    courier = (
        Membership.objects.filter(
            organization=actor.organization,
            user_id=courier_id,
            is_active=True,
            user__is_active=True,
        )
        .select_related("user")
        .first()
    )
    if caller is None or courier is None or ALLOCATE not in current_scope(actor).permissions:
        raise Http404
    target_actor = UploadActor(courier.user, actor.organization)
    if (
        not authorized_center_contexts(actor, ALLOCATE)
        .filter(pk__in=authorized_center_contexts(target_actor, "field_event.sync").values("pk"))
        .exists()
    ):
        raise Http404
    start = week_start(actor.organization, day)
    tasks = cast("QuerySet[Any]", task_query(caller, start, ALLOCATE)).filter(
        due_date=day,
        courier_id=courier_id,
        is_completed=False,
        pk__in=task_query(courier, start, "field_event.sync").values("pk"),
    )
    rows = list(tasks.order_by("pk"))
    contexts = [
        {
            "center_id": str(row.point.block.quadrant.center_id),
            "quadrant_id": str(row.point.block.quadrant_id),
        }
        for row in rows
    ]
    if contexts:
        require_contexts(actor, ALLOCATE, contexts)
        require_contexts(
            UploadActor(courier.user, actor.organization), "field_event.sync", contexts
        )
    revision = schedule_revision(actor.organization)
    if revision == 0:
        return {
            "status": "unavailable",
            "date": day.isoformat(),
            "courier_id": str(courier_id),
            "lines": [],
        }
    return _suggestion(
        rows, actor, {"date": day, "courier_id": courier_id, "schedule_revision": revision}
    )


def _suggestion(tasks: list[Any], actor: UploadActor, frame: dict[str, Any]) -> dict[str, Any]:
    latest = SupplyMaterialMappingVersion.objects.filter(
        supply_version_id=OuterRef("supply_version_id"), action=OuterRef("action")
    ).order_by("-revision")
    mappings = list(
        SupplyMaterialMappingVersion.objects.filter(
            organization=actor.organization, pk=Subquery(latest.values("pk")[:1]), is_active=True
        ).order_by("pk")
    )
    unconfigured = sorted({task.action for task in tasks} - {row.action for row in mappings})
    lines = []
    for mapping in mappings:
        matched = [task for task in tasks if task.action == mapping.action]
        if not matched:
            continue
        lines.append(
            {
                "supply_version_id": mapping.supply_version_id,
                "mapping_id": mapping.pk,
                "quantity": mapping.quantity * Decimal(len(matched)),
            }
        )
    data = json_facts(
        {
            "status": "unconfigured" if unconfigured else "assessed",
            **frame,
            "unconfigured_actions": unconfigured,
            "lines": lines,
        }
    )
    return cast(dict[str, Any], data)
