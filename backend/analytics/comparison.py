"""W56 comparison: one indicator across centers or quadrants, with the previous period beside it.

Same scoping and the same counting rules as the dashboards (`selectors`): a row is a center or a
quadrant the grant covers, with its numerator and denominator so every figure can be checked.
"""

# ruff: noqa: PLR0913 -- scope helpers take the caller, the grant, the permission and filters

from datetime import date, datetime, time, timedelta
from typing import Any, TypedDict
from zoneinfo import ZoneInfo

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery, Sum
from django.http import Http404
from rest_framework import serializers
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from analytics.charts import percent
from analytics.filters import MAX_RANGE_DAYS, scoped
from analytics.permissions import ENTOMOLOGY_READ, OPERATIONS_READ
from core.exceptions import FieldValidationError
from lab.models import LabResultRevision
from organizations.models import Center, Membership
from organizations.services import effective_scope
from ovitraps.models import OvitrapReading
from reviews.effect_receipts import effective_effects
from scheduling.models import ScheduledTask
from scheduling.selectors import tasks_with_completion

INDICATORS = ("positive_index", "coverage", "eggs_per_ovitrap")
GROUPS = ("quadrant", "center")
# Which dashboard permission each indicator belongs to.
INDICATOR_PERMISSION = {
    "positive_index": ENTOMOLOGY_READ,
    "eggs_per_ovitrap": ENTOMOLOGY_READ,
    "coverage": OPERATIONS_READ,
}
DEFAULT_DAYS = 28

_READING = "ovitrap__sampling_point__block__quadrant"
_TASK = "point__block__quadrant"


class ComparisonQuerySerializer(serializers.Serializer[Any]):
    indicator = serializers.ChoiceField(choices=INDICATORS, default="positive_index")
    group_by = serializers.ChoiceField(choices=GROUPS, default="quadrant")
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    center = serializers.UUIDField(required=False)


class ComparisonPermission(BasePermission):
    """The permission depends on the indicator asked for (entomology or operations)."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        membership = getattr(request, "membership", None)
        if membership is None:
            return False
        wanted = request.query_params.get("indicator") or "positive_index"
        code = INDICATOR_PERMISSION.get(wanted)
        # An unknown indicator passes here and fails validation (400) in the view.
        return code is None or effective_scope(membership).allows(code)


class Row(TypedDict):
    id: str
    center_id: str
    center_name: str
    quadrant_id: str | None
    quadrant_code: str | None
    numerator: float | int
    denominator: int
    value: float | None
    previous_value: float | None
    delta: float | None


class Comparison(TypedDict):
    cutoff: datetime
    indicator: str
    group_by: str
    unit: str
    date_from: str
    date_to: str
    previous_from: str
    previous_to: str
    rows: list[Row]


def require_center(member: Membership, indicator: str, center: Any) -> None:  # noqa: ANN401
    """A center outside the organization or the grant is a 404, never an empty comparison."""
    if center is None:
        return
    visible = scoped(
        Center.objects.all(), member, effective_scope(member), INDICATOR_PERMISSION[indicator]
    )
    if not visible.filter(pk=center).exists():
        raise Http404


def _bounds(zone: ZoneInfo, first: date, last: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(first, time.min, tzinfo=zone),
        datetime.combine(last + timedelta(days=1), time.min, tzinfo=zone),
    )


def _readings(
    member: Membership,
    effective: Any,  # noqa: ANN401
    first: date,
    last: date,
    center: Any,  # noqa: ANN401
) -> QuerySet[Any]:
    start, end = _bounds(ZoneInfo(member.organization.timezone), first, last)
    rows = scoped(OvitrapReading.objects.all(), member, effective, ENTOMOLOGY_READ)
    if center is not None:
        rows = rows.filter(**{f"{_READING}__center_id": center})
    in_range = rows.filter(event__device_time__gte=start, event__device_time__lt=end)
    return effective_effects(in_range, "event")


def _tasks(
    member: Membership,
    effective: Any,  # noqa: ANN401
    first: date,
    last: date,
    center: Any,  # noqa: ANN401
) -> QuerySet[Any]:
    rows = scoped(ScheduledTask.objects.all(), member, effective, OPERATIONS_READ)
    if center is not None:
        rows = rows.filter(**{f"{_TASK}__center_id": center})
    rows = rows.filter(due_date__gte=first, due_date__lte=last)
    return tasks_with_completion(rows, member.organization).order_by()


def _group_fields(prefix: str, group_by: str) -> list[str]:
    fields = [f"{prefix}__center_id", f"{prefix}__center__name"]
    if group_by == "quadrant":
        fields += [f"{prefix}_id", f"{prefix}__code"]
    return fields


def _totals(
    member: Membership,
    effective: Any,  # noqa: ANN401
    indicator: str,
    group_by: str,
    window: tuple[date, date],
    center: Any,  # noqa: ANN401
) -> dict[str, dict[str, Any]]:
    """Per group: numerator and denominator of the indicator over the local days of `window`."""
    first, last = window
    if indicator == "coverage":
        prefix = _TASK
        rows = (
            _tasks(member, effective, first, last, center)
            .values(*_group_fields(prefix, group_by))
            .annotate(den=Count("pk"), num=Count("pk", filter=Q(is_completed=True)))
        )
    else:
        prefix = _READING
        readings = _readings(member, effective, first, last, center)
        if indicator == "positive_index":
            aggregates: dict[str, Any] = {
                "den": Count("pk", filter=Q(paddle_present=True, is_index_excluded=False)),
                "num": Count("pk", filter=Q(has_eggs=True, is_index_excluded=False)),
            }
        else:
            current = (
                LabResultRevision.objects.filter(bag__reading=OuterRef("pk"))
                .order_by("-revision")
                .values("count__value")[:1]
            )
            readings = readings.annotate(eggs=Subquery(current))
            aggregates = {"den": Count("pk", filter=Q(eggs__isnull=False)), "num": Sum("eggs")}
        rows = readings.order_by().values(*_group_fields(prefix, group_by)).annotate(**aggregates)
    fields = _group_fields(prefix, group_by)
    by_quadrant = group_by == "quadrant"
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = str(row[fields[2]]) if by_quadrant else str(row[fields[0]])
        result[key] = {
            "center_id": str(row[fields[0]]),
            "center_name": row[fields[1]],
            "quadrant_id": str(row[fields[2]]) if by_quadrant else None,
            "quadrant_code": row[fields[3]] if by_quadrant else None,
            "num": row["num"] or 0,
            "den": row["den"],
        }
    return result


def _value(indicator: str, numerator: float | int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    if indicator == "eggs_per_ovitrap":
        return round(numerator / denominator, 1)
    return percent(int(numerator), denominator)


def compare(
    member: Membership,
    indicator: str,
    group_by: str,
    window: tuple[date, date],
    center: Any,  # noqa: ANN401
    now: datetime,
) -> Comparison:
    """Rows sorted by value (highest first); groups with nothing counted keep a null value."""
    first, last = window
    if first > last:
        raise FieldValidationError("date_from", "after_date_to")
    if (last - first).days >= MAX_RANGE_DAYS:
        raise FieldValidationError("date_to", "range_too_long")
    effective = effective_scope(member)
    length = (last - first).days + 1
    previous_to = first - timedelta(days=1)
    previous_from = previous_to - timedelta(days=length - 1)
    current = _totals(member, effective, indicator, group_by, window, center)
    before = _totals(member, effective, indicator, group_by, (previous_from, previous_to), center)
    rows: list[Row] = []
    for key, data in current.items():
        value = _value(indicator, data["num"], data["den"])
        old = before.get(key)
        previous = None if old is None else _value(indicator, old["num"], old["den"])
        rows.append(
            Row(
                id=key,
                center_id=data["center_id"],
                center_name=data["center_name"],
                quadrant_id=data["quadrant_id"],
                quadrant_code=data["quadrant_code"],
                numerator=data["num"],
                denominator=data["den"],
                value=value,
                previous_value=previous,
                delta=None if value is None or previous is None else round(value - previous, 1),
            )
        )
    rows.sort(
        key=lambda r: (
            r["value"] is None,
            -(r["value"] or 0),
            r["quadrant_code"] or r["center_name"],
        )
    )
    return Comparison(
        cutoff=now,
        indicator=indicator,
        group_by=group_by,
        unit="eggs" if indicator == "eggs_per_ovitrap" else "percent",
        date_from=first.isoformat(),
        date_to=last.isoformat(),
        previous_from=previous_from.isoformat(),
        previous_to=previous_to.isoformat(),
        rows=rows,
    )


class ComparisonRowSerializer(serializers.Serializer[Any]):
    id = serializers.CharField()
    center_id = serializers.UUIDField()
    center_name = serializers.CharField()
    quadrant_id = serializers.UUIDField(allow_null=True)
    quadrant_code = serializers.CharField(allow_null=True)
    numerator = serializers.FloatField()
    denominator = serializers.IntegerField()
    value = serializers.FloatField(allow_null=True)
    previous_value = serializers.FloatField(allow_null=True)
    delta = serializers.FloatField(allow_null=True)


class ComparisonSerializer(serializers.Serializer[Any]):
    cutoff = serializers.DateTimeField()
    indicator = serializers.ChoiceField(choices=INDICATORS)
    group_by = serializers.ChoiceField(choices=GROUPS)
    unit = serializers.CharField()
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    previous_from = serializers.DateField()
    previous_to = serializers.DateField()
    rows = ComparisonRowSerializer(many=True)
