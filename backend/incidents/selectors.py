"""Current projections and closed, scoped resource references."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, TypedDict, cast
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet, Subquery
from django.http import Http404
from django_stubs_ext import WithAnnotations

from catalogs.models import CatalogItem
from geography.models import Quadrant
from incidents.models import (
    Incident,
    IncidentBlocker,
    IncidentEvent,
    IncidentTypeVersion,
    NoticePublicationReceipt,
)
from organizations.models import Center, Membership, Organization
from organizations.scope import EffectiveScope
from organizations.selectors import filter_by_effective_scope
from ovitraps.lifecycle.models import OvitrapIncidentLink
from shifts.models import Motorcycle, Shift


def current_event(incident: Incident) -> IncidentEvent:
    return cast(IncidentEvent, incident.events.order_by("-revision")[0])


class IncidentProjection(TypedDict):
    revision: int
    state: str
    owner_id: UUID
    severity: str
    deadline: Any
    stage: int
    last_reminder_at: Any
    latest_event_id: UUID
    notice_outboxed: bool


def projected_incidents(
    organization: Organization,
) -> QuerySet[WithAnnotations[Incident, IncidentProjection]]:
    latest = IncidentEvent.objects.filter(incident=OuterRef("pk")).order_by("-revision")
    return cast(
        "QuerySet[WithAnnotations[Incident, IncidentProjection]]",
        Incident.objects.filter(organization=organization).annotate(
            revision=Subquery(latest.values("revision")[:1]),
            state=Subquery(latest.values("state")[:1]),
            owner_id=Subquery(latest.values("owner_id")[:1]),
            severity=Subquery(latest.values("severity")[:1]),
            deadline=Subquery(latest.values("deadline")[:1]),
            stage=Subquery(latest.values("stage")[:1]),
            last_reminder_at=Subquery(latest.values("last_reminder_at")[:1]),
            latest_event_id=Subquery(latest.values("pk")[:1]),
            notice_outboxed=Exists(
                NoticePublicationReceipt.objects.filter(
                    cause_kind="incident_event", cause_id=OuterRef("latest_event_id")
                )
            ),
        ),
    )


def scoped_incidents(member: Membership, permission: str) -> QuerySet[Incident]:
    query = projected_incidents(member.organization)
    full = filter_by_effective_scope(query, member, permission)
    # Reuse the existing center resource authorization for rows with no applicable
    # quadrant; never borrow a quadrant from another action/profile grant.
    centers = filter_by_effective_scope(
        Center.objects.filter(organization=member.organization), member, permission
    )
    return query.filter(Q(pk__in=full.values("pk")) | Q(quadrant__isnull=True, center__in=centers))


def latest_types(organization: Organization) -> QuerySet[IncidentTypeVersion]:
    latest = IncidentTypeVersion.objects.filter(item_id=OuterRef("item_id")).order_by("-revision")
    return IncidentTypeVersion.objects.filter(
        organization=organization, pk=Subquery(latest.values("pk")[:1])
    ).select_related("supervisor__user", "coordinator__user", "terminal__user")


def type_versions(organization: Organization, item_id: UUID) -> QuerySet[IncidentTypeVersion]:
    """The stable organization catalog item names immutable history, never a version UUID."""
    if not CatalogItem.objects.filter(
        organization=organization, catalog__slug="incident-type", pk=item_id
    ).exists():
        raise Http404
    return (
        IncidentTypeVersion.objects.filter(organization=organization, item_id=item_id)
        .select_related("supervisor__user", "coordinator__user", "terminal__user")
        .order_by("-revision", "pk")
    )


def unconfigured_type_items(
    organization: Organization, code: str | None = None
) -> QuerySet[CatalogItem]:
    """Expose real catalog identities for first configuration without supplying policy defaults."""
    configured = IncidentTypeVersion.objects.filter(
        organization=organization, item_id=OuterRef("pk")
    )
    rows = (
        CatalogItem.objects.filter(organization=organization, catalog__slug="incident-type")
        .filter(~Exists(configured))
        .order_by("is_other", "sort", "pk")
    )
    return rows.filter(code=code) if code is not None else rows


def active_blockers(organization: Organization) -> QuerySet[IncidentBlocker]:
    """No unrelated incident/fleet/removal blocker is resolved by this incident's close."""
    return IncidentBlocker.objects.filter(
        organization=organization,
        incident__in=projected_incidents(organization).filter(state="open"),
    )


@dataclass(frozen=True)
class ResourceContext:
    center_id: UUID
    quadrant_id: UUID | None = None
    resource_kind: str | None = None
    resource_id: UUID | None = None
    marker: OvitrapIncidentLink | None = None


def resource_context(
    organization: Organization, data: dict[str, Any], shift_id: UUID | None = None
) -> ResourceContext:
    explicit = _explicit_scope(organization, data.get("scope"))
    reference = data.get("resource_ref")
    if reference:
        context = _resource_scope(organization, reference)
        if explicit and (
            explicit.center_id != context.center_id or explicit.quadrant_id != context.quadrant_id
        ):
            raise Http404
        return context
    if explicit:
        return explicit
    if shift_id:
        shift = (
            Shift.objects.select_related("motorcycle")
            .filter(organization=organization, pk=shift_id)
            .first()
        )
        if shift and shift.motorcycle.center_id:
            return ResourceContext(shift.motorcycle.center_id)
    raise Http404


def _explicit_scope(
    organization: Organization, value: dict[str, Any] | None
) -> ResourceContext | None:
    if not value:
        return None
    center = Center.objects.filter(organization=organization, pk=value["center_id"]).first()
    if center is None:
        raise Http404
    quadrant_id = value.get("quadrant_id")
    if (
        quadrant_id
        and not Quadrant.objects.filter(
            organization=organization, pk=quadrant_id, center=center
        ).exists()
    ):
        raise Http404
    return ResourceContext(center.pk, UUID(str(quadrant_id)) if quadrant_id else None)


def _resource_scope(organization: Organization, reference: dict[str, Any]) -> ResourceContext:
    if reference["kind"] == "motorcycle":
        motorcycle = Motorcycle.objects.filter(
            organization=organization, pk=reference["id"]
        ).first()
        if motorcycle is None or motorcycle.center_id is None:
            raise Http404
        return ResourceContext(
            motorcycle.center_id, resource_kind="motorcycle", resource_id=motorcycle.pk
        )
    if reference["kind"] != "ovitrap_marker":
        raise Http404
    marker = (
        OvitrapIncidentLink.objects.select_related("ovitrap__sampling_point__block__quadrant")
        .filter(organization=organization, pk=reference["id"])
        .first()
    )
    if marker is None:
        raise Http404
    point = marker.ovitrap.sampling_point
    return ResourceContext(point.center_id, point.quadrant_id, "ovitrap", marker.ovitrap_id, marker)


def require_context(scope: EffectiveScope, permission: str, context: ResourceContext) -> None:
    if not scope.allows(
        permission,
        str(context.center_id),
        str(context.quadrant_id) if context.quadrant_id else None,
    ):
        raise Http404
