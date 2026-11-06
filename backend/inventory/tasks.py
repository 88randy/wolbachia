"""Bounded recovery of pending biological incident sources; no delivery claim."""

from datetime import datetime
from uuid import UUID

from celery import shared_task
from django.db.models import Q

from inventory.conditions import reconcile_condition_incident
from inventory.exceptions import InventoryInProgressError
from inventory.models import ConditionBreach


@shared_task
def recover_condition_incidents(after_time: str | None = None, after_id: str | None = None) -> int:
    query = ConditionBreach.objects.filter(incident_link__isnull=True).select_related(
        "organization", "reading__lot"
    )
    if after_time and after_id:
        at, identifier = datetime.fromisoformat(after_time), UUID(after_id)
        query = query.filter(Q(created_at__gt=at) | Q(created_at=at, pk__gt=identifier))
    page = list(query.order_by("created_at", "pk")[:101])
    linked = 0
    for breach in page[:100]:
        try:
            linked += reconcile_condition_incident(breach) is not None
        except InventoryInProgressError:
            continue
    if len(page) > 100:
        last = page[99]
        recover_condition_incidents.delay(last.created_at.isoformat(), str(last.pk))
    return linked
