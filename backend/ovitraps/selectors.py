"""Scoped identities and historical capture context; no writes."""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery
from django.db.models.functions import JSONObject
from rest_framework.exceptions import NotFound

from core.snapshots import snapshot_hash
from field_sync.envelope import EventEnvelope
from field_sync.exceptions import EventRejected
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.producers import ProducerContext, filter_producer_rows
from field_sync.registry import EventContext
from geography.models import PointVersion, SamplingPoint
from organizations.models import Membership, Organization
from organizations.selectors import filter_by_effective_scope
from ovitraps.codes import OVITRAP_INACCESSIBLE, POINT_INACCESSIBLE
from ovitraps.models import Ovitrap, OvitrapReading, OvitrapVoid


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
    visible = event_scoped(points, ctx)
    point = visible.select_for_update(no_key=True, of=("self",)).filter(pk=identifier).first()
    if point is None:
        raise EventRejected(POINT_INACCESSIBLE)
    return cast(SamplingPoint, point)


def accessible_ovitrap(ctx: EventContext, identifier: UUID) -> Ovitrap:
    # Read scoped first; the common domain lock always precedes all descendant locks.
    visible = event_scoped(Ovitrap.objects.filter(organization=ctx.organization), ctx)
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


def event_scoped(rows: QuerySet[Any], ctx: EventContext) -> QuerySet[Any]:
    if ctx.review_authorization is not None:
        from organizations.selectors import filter_by_scope

        return filter_by_scope(rows, ctx.review_authorization.historical_scope, FIELD_EVENT_SYNC)
    return filter_by_effective_scope(rows, sync_membership(ctx), FIELD_EVENT_SYNC)


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
    if model_name == "ovitrap":
        from ovitraps.lifecycle.selectors import with_retirement

        queryset = with_retirement(queryset, membership.organization)
        if state == "active":
            return queryset.filter(
                event__voided_at__isnull=True, **{"is_replaced": False, "is_removed": False}
            )
        if state == "voided":
            return queryset.filter(event__voided_at__isnull=False)
        return queryset
    if state != "all":
        queryset = queryset.filter(event__voided_at__isnull=state == "active")
    return queryset


OVITRAP_LOOKUPS = (
    "sampling_point__block__quadrant__center_id",
    "sampling_point__block__quadrant_id",
)


def projected_ovitraps(organization: Organization) -> QuerySet[Ovitrap]:
    """One bounded-query projection including voids and latest NON-voided device-time check."""
    latest = OvitrapReading.objects.filter(
        organization=organization, ovitrap=OuterRef("pk"), event__voided_at__isnull=True
    ).order_by("-event__device_time", "-event_id")
    reading_events = OvitrapReading.objects.filter(
        organization=organization, ovitrap_id=OuterRef(OuterRef("pk"))
    ).values("event_id")
    lifecycle = (
        OvitrapVoid.objects.filter(organization=organization)
        .filter(
            Q(target_event_id=OuterRef("event_id"))
            | Q(target_event_id__in=Subquery(reading_events))
        )
        .order_by("-created_at", "-pk")
    )
    reading_revisions = (
        OvitrapReading.objects.filter(organization=organization, ovitrap=OuterRef("pk"))
        .order_by()
        .values("ovitrap_id")
        .annotate(revision=Count("pk"))
        .values("revision")[:1]
    )
    void_revisions = (
        lifecycle.order_by()
        .values("organization_id")
        .annotate(revision=Count("pk"))
        .values("revision")[:1]
    )
    current_point = (
        PointVersion.objects.filter(
            point_id=OuterRef("sampling_point_id"), organization=organization
        )
        .order_by("-version")
        .values("version")[:1]
    )
    rows = (
        Ovitrap.objects.filter(organization=organization)
        .select_related("sampling_point__block__quadrant", "point_version", "event")
        .annotate(
            sampling_point_version=Subquery(current_point),
            reading_revision=Subquery(reading_revisions),
            void_revision=Subquery(void_revisions),
            latest_check=Subquery(
                latest.values(
                    summary=JSONObject(
                        reading_id="pk",
                        event_id="event_id",
                        finding_code="finding_code",
                        paddle_present="paddle_present",
                        has_eggs="has_eggs",
                        checked_at="event__device_time",
                        is_lagged="is_lagged",
                    )
                )[:1]
            ),
            latest_void=Subquery(
                lifecycle.values(
                    summary=JSONObject(
                        target_id="target_event_id",
                        target_type="target_event__type",
                        void_reason_code="reason_code",
                        voided_at="target_event__voided_at",
                    )
                )[:1]
            ),
        )
        .order_by("client_uuid")
    )
    from ovitraps.lifecycle.selectors import with_retirement

    return with_retirement(cast("QuerySet[Ovitrap]", rows), organization)


def ovitrap_row(ovitrap: Ovitrap) -> dict[str, Any]:
    check = getattr(ovitrap, "latest_check", None) or {}
    lifecycle = getattr(ovitrap, "latest_void", None) or {}
    placement_voided = ovitrap.event.voided_at is not None
    return {
        "organization_id": str(ovitrap.organization_id),
        "center_id": str(ovitrap.sampling_point.block.quadrant.center_id),
        "quadrant_id": str(ovitrap.sampling_point.block.quadrant_id),
        "id": str(ovitrap.client_uuid),
        "client_uuid": str(ovitrap.client_uuid),
        "version": ovitrap_resource_version(ovitrap),
        "code": ovitrap.code,
        "sampling_point_id": str(ovitrap.sampling_point_id),
        "point_version": str(ovitrap.point_version_id),
        "sampling_point_version": getattr(
            ovitrap, "sampling_point_version", ovitrap.point_version.version
        ),
        "placed_at": ovitrap.event.device_time,
        **{
            key: check.get(key)
            for key in (
                "reading_id",
                "finding_code",
                "paddle_present",
                "has_eggs",
                "checked_at",
                "is_lagged",
            )
        },
        "is_retired": bool(
            getattr(ovitrap, "is_replaced", False) or getattr(ovitrap, "is_removed", False)
        ),
        "placement_voided": placement_voided,
        "voided": bool(lifecycle) or placement_voided,
        "voided_resource_type": (
            "placement" if lifecycle.get("target_type") == "ovitrap.place" else "reading"
        )
        if lifecycle
        else ("placement" if placement_voided else None),
        "voided_event_id": lifecycle.get("target_id")
        or (str(ovitrap.event_id) if placement_voided else None),
        "void_reason_code": lifecycle.get("void_reason_code", ovitrap.event.void_reason_code),
        "voided_at": lifecycle.get("voided_at", ovitrap.event.voided_at),
    }


def build_ovitrap_bundle(ctx: ProducerContext) -> list[dict[str, Any]]:
    rows = filter_producer_rows(projected_ovitraps(ctx.organization), ctx, OVITRAP_LOOKUPS)
    return [ovitrap_row(ovitrap) for ovitrap in rows]


def ovitrap_resource_version(ovitrap: Ovitrap) -> str:
    """Stable revision of append-only lifecycle effects, also for backdated checks."""
    return snapshot_hash(
        {
            "replacement": str(getattr(ovitrap, "replacement_event_id", None)),
            "removal": str(getattr(ovitrap, "removal_event_id", None)),
            "placement": str(ovitrap.event_id),
            "placement_voided": ovitrap.event.voided_at is not None,
            "readings": getattr(ovitrap, "reading_revision", None) or 0,
            "voids": getattr(ovitrap, "void_revision", None) or 0,
            "point": getattr(ovitrap, "sampling_point_version", ovitrap.point_version.version),
        }
    )


def latest_check_with_pending(
    ovitrap: Ovitrap, reading: OvitrapReading, event: EventEnvelope
) -> dict[str, Any]:
    """Overlay an uncommitted event using the same order as the SQL latest selector."""
    current = ovitrap.latest_check
    if current is not None and (event.device_time, str(event.id)) < (
        datetime.fromisoformat(current["checked_at"]),
        current["event_id"],
    ):
        return current
    return {
        "reading_id": str(reading.pk),
        "event_id": str(event.id),
        "finding_code": reading.finding_code,
        "paddle_present": reading.paddle_present,
        "has_eggs": reading.has_eggs,
        "checked_at": event.device_time,
        "is_lagged": reading.is_lagged,
    }
