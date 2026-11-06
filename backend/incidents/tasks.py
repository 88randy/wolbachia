"""Bounded scheduler and recoverable post-commit producers. B-07 owns delivery."""

from datetime import datetime
from uuid import UUID

from celery import shared_task


@shared_task
def publish_incident_notices(kind: str, identifier: str) -> bool:
    from incidents.notices import publish

    return publish(kind, UUID(identifier))


@shared_task
def recover_incident_notices(kind: str, created_at: str, identifier: str) -> int:
    from incidents.notices import recover_publication_page

    return recover_publication_page(kind, (datetime.fromisoformat(created_at), UUID(identifier)))


@shared_task
def maintain_incidents(
    after_created_at: str | None = None, after_id: str | None = None
) -> dict[str, int]:
    from django.db.models import OuterRef, Q, Subquery

    from core.time import server_now
    from incidents.exceptions import IncidentConflictError, IncidentInProgressError
    from incidents.models import Incident, IncidentEvent
    from incidents.notices import recover_publications
    from incidents.services import escalate

    count = 0
    # Per-incident arbiter rechecks due state; no locks or network retained between cases.
    now = server_now()
    latest = IncidentEvent.objects.filter(incident_id=OuterRef("pk")).order_by("-revision")
    query = Incident.objects.annotate(current_state=Subquery(latest.values("state")[:1])).filter(
        current_state="open"
    )
    if after_created_at and after_id:
        at, identifier = datetime.fromisoformat(after_created_at), UUID(after_id)
        query = query.filter(Q(created_at__gt=at) | Q(created_at=at, pk__gt=identifier))
    # Read all open cases in bounded pages, so a newly unavailable intermediate
    # advances before its old deadline and later cases cannot starve behind LIMIT.
    page = list(query.select_related("organization").order_by("created_at", "pk")[:101])
    for incident in page[:100]:
        try:
            count += escalate(incident, now) is not None
        except (IncidentConflictError, IncidentInProgressError):
            continue
    if len(page) > 100:
        last = page[99]
        maintain_incidents.delay(last.created_at.isoformat(), str(last.pk))
    return {"transitions": count, "publications": recover_publications() if after_id is None else 0}
