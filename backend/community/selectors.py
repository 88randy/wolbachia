"""One paired scoped/filter predicate owns display rows and all-input active totals."""

from typing import Any

from django.db.models import Count, DecimalField, Exists, OuterRef, QuerySet, Subquery, Sum

from community.models import CommunityActivity, CommunityActivityEvent
from community.policy import READ
from geography.models import Block
from organizations.selectors import filter_by_scope
from uploads.access import UploadActor, current_scope


def scoped_activities(actor: UploadActor, permission: str = READ) -> QuerySet[Any]:
    events = CommunityActivityEvent.objects.filter(activity_id=OuterRef("pk")).order_by("-revision")
    query = (
        CommunityActivity.objects.filter(organization=actor.organization)
        .select_related("zone__quadrant", "zone_version", "complaint_link__incident")
        .prefetch_related("events")
    )
    query = query.annotate(
        revision=Subquery(events.values("revision")[:1]),
        is_voided=Exists(events.filter(action="void")),
    )
    return filter_by_scope(query, current_scope(actor), permission)


def filter_activities(query: QuerySet[Any], values: dict[str, Any]) -> QuerySet[Any]:
    lookups = {
        "code": "code",
        "zone_id": "zone_id",
        "center": "zone__quadrant__center_id",
        "quadrant": "zone__quadrant_id",
        "type_id": "type_id",
        "date_from": "activity_date__gte",
        "date_before": "activity_date__lt",
    }
    return query.filter(**{lookups[key]: value for key, value in values.items() if key in lookups})


def active_totals(query: QuerySet[Any]) -> dict[str, Any]:
    totals = query.filter(is_voided=False).aggregate(
        active_activity_count=Count("pk"),
        attendance=Sum("attendance", output_field=DecimalField(max_digits=38, decimal_places=0)),
    )
    return {
        "active_activity_count": totals["active_activity_count"],
        "attendance": str(int(totals["attendance"] or 0)),
    }


def zone_options(actor: UploadActor, permission: str) -> QuerySet[Block]:
    return filter_by_scope(
        Block.objects.filter(
            organization=actor.organization,
            quadrant__organization=actor.organization,
            quadrant__center__organization=actor.organization,
        ).select_related("quadrant__center"),
        current_scope(actor),
        permission,
    ).order_by("code", "id")
