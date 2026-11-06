"""After-commit publication of minimal, deduplicated B-07 intents; no delivery claim."""

from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import Any
from uuid import UUID

from django.db import transaction

from field_sync.models import FieldEvent
from field_sync.selectors import captured_scope, membership_snapshots
from incidents.configuration import eligible_owner
from incidents.exceptions import IncidentInProgressError
from incidents.models import Incident, IncidentEvent, IncidentNoticeIntent, NoticePublicationReceipt
from incidents.permissions import INCIDENT_READ
from incidents.selectors import ResourceContext, current_event, latest_types, resource_context
from incidents.transactions import incident_transaction
from organizations.models import Organization
from organizations.scope import EffectiveScope
from shifts.models import MotorcycleBlockEvent


def enqueue_notice(kind: str, identifier: UUID) -> None:
    from incidents.tasks import publish_incident_notices

    transaction.on_commit(
        partial(publish_incident_notices.delay, kind, str(identifier)), robust=True
    )


def stored_source(event: FieldEvent) -> None:
    if event.type == "emergency.accident" and event.status != "rejected":
        enqueue_notice("critical_source", event.pk)


@dataclass(frozen=True)
class NoticeCause:
    organization: Organization
    context: ResourceContext
    code: str
    params: dict[str, Any]
    courier_id: UUID | None = None
    incident: Incident | None = None


def _cause(kind: str, identifier: UUID) -> NoticeCause | None:
    from django.http import Http404

    if kind == "incident_event":
        event = (
            IncidentEvent.objects.select_related("incident__organization", "incident__type_version")
            .filter(pk=identifier)
            .first()
        )
        if event is None:
            return None
        incident = event.incident
        return NoticeCause(
            incident.organization,
            ResourceContext(incident.center_id, incident.quadrant_id),
            f"incident.{event.action}",
            {
                "incident_id": str(incident.pk),
                "event_id": str(event.pk),
                "revision": event.revision,
            },
            courier_id=incident.created_by_id,
            incident=incident,
        )
    if kind == "critical_source":
        source = (
            FieldEvent.objects.select_related("organization")
            .filter(pk=identifier, type="emergency.accident")
            .exclude(status="rejected")
            .first()
        )
        if source is None:
            return None
        try:
            context = resource_context(source.organization, source.payload, source.shift_id)
        except (Http404, KeyError, ValueError, TypeError):
            return None
        if source.status == "in_review":
            review = source.review_item
            return NoticeCause(
                source.organization,
                context,
                "incident.critical_review",
                {"review_item_id": str(review.pk), "event_id": str(source.pk)},
                courier_id=source.created_by_id,
            )
        return NoticeCause(
            source.organization,
            context,
            "incident.critical_source",
            {"event_id": str(source.pk)},
            courier_id=source.created_by_id,
        )
    if kind == "severe_fault":
        fault = (
            MotorcycleBlockEvent.objects.select_related("motorcycle", "organization")
            .filter(pk=identifier, action="block", blocked_reason="severe_check")
            .first()
        )
        if fault is None or fault.motorcycle.center_id is None:
            return None
        return NoticeCause(
            fault.organization,
            ResourceContext(fault.motorcycle.center_id),
            "incident.severe_fault",
            {"fault_id": str(fault.pk)},
        )
    return None


def publish(kind: str, identifier: UUID) -> bool:
    cause = _cause(kind, identifier)
    if cause is None:
        return False
    with incident_transaction(None, cause.organization):
        if NoticePublicationReceipt.objects.filter(cause_kind=kind, cause_id=identifier).exists():
            return True
        recipients = _recipients(cause, kind)
        if not recipients:
            return False
        receipt = NoticePublicationReceipt.objects.create(
            organization=cause.organization,
            actor_kind="system",
            cause_kind=kind,
            cause_id=identifier,
        )
        for recipient in sorted(recipients, key=str):
            IncidentNoticeIntent.objects.create(
                organization=cause.organization,
                actor_kind="system",
                publication=receipt,
                recipient_id=recipient,
                kind=cause.code,
                params=cause.params,
            )
        return True


CAUSE_KINDS = ("incident_event", "critical_source", "severe_fault")


def recover_publications(limit: int = 100) -> int:
    return sum(recover_publication_page(kind, None, limit) for kind in CAUSE_KINDS)


def recover_publication_page(
    kind: str, after: tuple[datetime, UUID] | None, limit: int = 100
) -> int:
    """Keyset continuations advance even past unresolved causes; each page is bounded."""
    from django.db.models import Exists, OuterRef, Q

    from incidents.tasks import recover_incident_notices

    queries = {
        "incident_event": IncidentEvent.objects.all(),
        "critical_source": FieldEvent.objects.filter(type="emergency.accident").exclude(
            status="rejected"
        ),
        "severe_fault": MotorcycleBlockEvent.objects.filter(
            action="block", blocked_reason="severe_check"
        ),
    }
    query = queries[kind]
    published = NoticePublicationReceipt.objects.filter(cause_kind=kind, cause_id=OuterRef("pk"))
    query = query.annotate(published=Exists(published)).filter(published=False)
    if after:
        query = query.filter(Q(created_at__gt=after[0]) | Q(created_at=after[0], pk__gt=after[1]))
    page = list(query.order_by("created_at", "pk").values_list("created_at", "pk")[: limit + 1])
    count = 0
    for _created, identifier in page[:limit]:
        try:
            count += publish(kind, identifier)
        except IncidentInProgressError:
            continue
    if len(page) > limit:
        created, identifier = page[limit - 1]
        # Publication transactions have exited; broker I/O never runs under domain locks.
        recover_incident_notices.delay(kind, created.isoformat(), str(identifier))
    return count


def _recipients(cause: NoticeCause, kind: str) -> set[UUID]:
    recipients: set[UUID] = set()
    accountable = False
    owner_user_id, terminal_id = _case_responsibility(cause)
    for member in membership_snapshots(cause.organization):
        scope = captured_scope(member)
        if not _can_read_cause(scope, cause):
            continue
        slugs = {profile["slug"] for profile in member.scope_profiles}  # type: ignore[attr-defined]
        if slugs & {"supervisor", "coordinator"} or member.user_id == owner_user_id:
            accountable = True
        if slugs & {"supervisor", "coordinator"} or member.user_id in {
            owner_user_id,
            cause.courier_id,
        }:
            recipients.add(member.user_id)
    if not accountable:
        if cause.incident is not None:
            terminal_ids = [terminal_id]
        else:
            type_code = (
                "emergency-accident" if kind == "critical_source" else "motorcycle-severe-check"
            )
            terminal_ids = list(
                latest_types(cause.organization)
                .filter(is_active=True, code=type_code)
                .values_list("terminal_id", flat=True)
            )
        for identifier in terminal_ids:
            terminal = eligible_owner(identifier, cause.organization, cause.context, terminal=True)
            if terminal and _can_read_cause(captured_scope(terminal), cause):
                recipients.add(terminal.user_id)
                accountable = True
    return recipients if accountable else set()


def _case_responsibility(cause: NoticeCause) -> tuple[UUID | None, UUID | None]:
    """Publisher already owns Organization: resolve current responsibility without new locks."""
    if cause.incident is None:
        return None, None
    latest = current_event(cause.incident)
    owner = eligible_owner(
        latest.owner_id, cause.organization, cause.context, terminal=latest.stage == 2
    )
    terminal_id = latest.owner_id if latest.stage == 2 else cause.incident.type_version.terminal_id
    return owner.user_id if owner else None, terminal_id


def _can_read_cause(scope: EffectiveScope, cause: NoticeCause) -> bool:
    center = str(cause.context.center_id)
    quadrant = str(cause.context.quadrant_id) if cause.context.quadrant_id else None
    if not scope.allows(INCIDENT_READ, center, quadrant):
        return False
    if cause.code == "incident.critical_review":
        return scope.allows("review_item.read", center, quadrant)
    if cause.code == "incident.severe_fault":
        return scope.allows("motorcycle.read", center)
    return True
