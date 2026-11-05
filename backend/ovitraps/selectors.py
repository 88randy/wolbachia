"""Scoped identities and historical capture context; no writes."""

from typing import Any, cast
from uuid import UUID

from django.db.models import QuerySet
from rest_framework.exceptions import NotFound

from field_sync.exceptions import EventRejected
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.registry import EventContext
from geography.models import SamplingPoint
from organizations.models import Membership
from organizations.selectors import filter_by_effective_scope
from ovitraps.codes import OVITRAP_INACCESSIBLE, POINT_INACCESSIBLE
from ovitraps.models import Ovitrap, OvitrapReading


def sync_membership(ctx: EventContext) -> Membership:
    membership = Membership.objects.filter(
        organization=ctx.organization,
        user=ctx.user,
        is_active=True,
        organization__is_active=True,
        user__is_active=True,
    ).first()
    if membership is None:
        raise EventRejected(POINT_INACCESSIBLE)
    return membership


def accessible_point(ctx: EventContext, identifier: UUID) -> SamplingPoint:
    points = SamplingPoint.objects.filter(organization=ctx.organization).select_related(
        "block__quadrant__center"
    )
    visible = filter_by_effective_scope(points, sync_membership(ctx), FIELD_EVENT_SYNC)
    point = visible.select_for_update(no_key=True, of=("self",)).filter(pk=identifier).first()
    if point is None:
        raise EventRejected(POINT_INACCESSIBLE)
    return cast(SamplingPoint, point)


def accessible_ovitrap(ctx: EventContext, identifier: UUID) -> Ovitrap:
    # Read scoped first; the common domain lock always precedes all descendant locks.
    visible = filter_by_effective_scope(
        Ovitrap.objects.filter(organization=ctx.organization),
        sync_membership(ctx),
        FIELD_EVENT_SYNC,
    )
    ovitrap = visible.filter(client_uuid=identifier).first()
    if ovitrap is None:
        raise EventRejected(OVITRAP_INACCESSIBLE)
    accessible_point(ctx, ovitrap.sampling_point_id)
    locked = Ovitrap.objects.select_for_update(no_key=True).get(
        organization=ctx.organization, pk=ovitrap.pk
    )
    if locked.event.voided_at is not None:
        raise EventRejected(OVITRAP_INACCESSIBLE)
    return cast(Ovitrap, locked)


def filter_records(  # noqa: PLR0913 -- query and its authorization context
    queryset: QuerySet[Any], query: dict[str, Any], membership: Membership, permission: str
) -> QuerySet[Any]:
    model_name = queryset.model._meta.model_name
    point_path = {
        "ovitrap": "sampling_point_id",
        "ovitrapreading": "ovitrap__sampling_point_id",
        "bag": "reading__ovitrap__sampling_point_id",
    }[model_name]
    if point_id := query.get("point"):
        points = filter_by_effective_scope(
            SamplingPoint.objects.filter(organization=membership.organization),
            membership,
            permission,
        )
        if not points.filter(pk=point_id).exists():
            raise NotFound
        queryset = queryset.filter(**{point_path: point_id})
    if week := query.get("week"):
        if model_name == "ovitrap":
            readings = OvitrapReading.objects.filter(
                organization=membership.organization, epi_week=week
            )
            queryset = queryset.filter(pk__in=readings.values("ovitrap_id"))
        else:
            queryset = queryset.filter(
                **{("reading__epi_week" if model_name == "bag" else "epi_week"): week}
            )
    state = query.get("status", "active")
    if state != "all":
        queryset = queryset.filter(event__voided_at__isnull=state == "active")
    return queryset
