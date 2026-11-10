"""Dashboard aggregates. Every query is scoped by organization and grant, aggregated in SQL and
bounded by the date range (at most 366 days); weeks are bucketed in Python from per-day rows."""

# ruff: noqa: PLR0913 -- scope helpers take the caller, the grant, the permission and filters

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, TypedDict
from zoneinfo import ZoneInfo

from django.db.models import Count, ExpressionWrapper, F, IntegerField, OuterRef, Q, Subquery, Sum
from django.db.models.functions import TruncDate

from analytics.charts import (
    Chart,
    Indicator,
    Label,
    Series,
    chart,
    label,
    percent,
    period_key,
    wilson_interval,
)
from analytics.filters import DashboardFilters, apply_area, scoped, validate_scope_filters
from analytics.permissions import ENTOMOLOGY_READ, OPERATIONS_READ, WOLBACHIA_READ
from fleet.models import FuelLoad
from incidents.selectors import scoped_incidents
from lab.models import LabResultRevision
from lab.samples.selectors import sample_rows, valid_results
from organizations.models import Membership
from organizations.services import effective_scope
from ovitraps.models import OvitrapReading
from reviews.effect_receipts import effective_effects
from scheduling.models import ScheduledTask
from scheduling.selectors import tasks_with_completion
from shifts.models import Motorcycle, Shift
from uploads.access import UploadActor

POINT_CENTER = "ovitrap__sampling_point__block__quadrant__center_id"
POINT_QUADRANT = "ovitrap__sampling_point__block__quadrant_id"
TASK_QUADRANT = "point__block__quadrant_id"
TASK_QUADRANT_CODE = "point__block__quadrant__code"


class Dashboard(TypedDict):
    cutoff: datetime
    filters: dict[str, str | None]
    indicators: list[Indicator]
    charts: list[Chart]
    notes: list[Label]


def _indicator(key: str, value: float | int | None, unit: str) -> Indicator:
    return Indicator(key=key, label=label(f"analytics.indicator.{key}"), value=value, unit=unit)


# ---------------------------------------------------------------- W55 operations


def operations_dashboard(member: Membership, filters: DashboardFilters, now: datetime) -> Dashboard:
    effective = effective_scope(member)
    validate_scope_filters(member, effective, OPERATIONS_READ, filters)
    organization = member.organization
    convention = organization.epi_week
    start, end = filters.bounds(organization)

    tasks = apply_area(
        scoped(ScheduledTask.objects.all(), member, effective, OPERATIONS_READ),
        filters,
        "point__block__quadrant__center_id",
        TASK_QUADRANT,
    ).filter(due_date__gte=filters.date_from, due_date__lte=filters.date_to)
    tasks = tasks_with_completion(tasks, organization).order_by()
    done = Count("pk", filter=Q(is_completed=True))
    daily = list(
        tasks.values("due_date").annotate(planned=Count("pk"), done=done).order_by("due_date")
    )
    by_quadrant = list(
        tasks.values(TASK_QUADRANT, TASK_QUADRANT_CODE)
        .annotate(planned=Count("pk"), done=done)
        .order_by(TASK_QUADRANT_CODE)
    )

    periods: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in daily:
        bucket = periods[period_key(row["due_date"], filters.granularity, convention)]
        bucket[0] += row["planned"]
        bucket[1] += row["done"]
    ordered = sorted(periods.items())
    planned_total = sum(row["planned"] for row in daily)
    done_total = sum(row["done"] for row in daily)

    tasks_chart = chart(
        "tasks_done_vs_planned",
        "bar",
        "count",
        [
            Series(
                key=name,
                label=label(f"analytics.series.{name}"),
                points=[{"x": period, "y": values[index]} for period, values in ordered],
            )
            for index, name in enumerate(("planned", "done"))
        ],
        ["period", "planned", "done", "coverage_pct"],
        [
            {"period": p, "planned": v[0], "done": v[1], "coverage_pct": percent(v[1], v[0])}
            for p, v in ordered
        ],
    )
    coverage_rows = [
        {
            "quadrant_id": str(row[TASK_QUADRANT]),
            "quadrant": row[TASK_QUADRANT_CODE],
            "planned": row["planned"],
            "done": row["done"],
            "coverage_pct": percent(row["done"], row["planned"]),
        }
        for row in by_quadrant
    ]
    coverage_chart = chart(
        "coverage_by_quadrant",
        "bar",
        "percent",
        [
            Series(
                key="coverage",
                label=label("analytics.series.coverage"),
                points=[{"x": r["quadrant"], "y": r["coverage_pct"]} for r in coverage_rows],
            )
        ],
        ["quadrant", "planned", "done", "coverage_pct"],
        coverage_rows,
    )

    open_shifts = _open_shifts(member, effective, filters)
    incident_rows, open_now = _incident_counts(member, filters, start, end)
    incidents_chart = chart(
        "incidents_by_state",
        "bar",
        "count",
        [
            Series(
                key="incidents",
                label=label("analytics.series.incidents"),
                points=[{"x": r["state"], "y": r["count"]} for r in incident_rows],
            )
        ],
        ["state", "count"],
        incident_rows,
    )
    fuel_chart, litres_per_km = _fuel_chart(member, effective, filters, start, end, convention)
    return Dashboard(
        cutoff=now,
        filters=filters.echo(),
        indicators=[
            _indicator("tasks_planned", planned_total, "count"),
            _indicator("tasks_done", done_total, "count"),
            _indicator("coverage", percent(done_total, planned_total), "percent"),
            _indicator("couriers_in_field", open_shifts, "count"),
            _indicator("incidents_open", open_now, "count"),
            _indicator(
                "incidents_closed",
                next((r["count"] for r in incident_rows if r["state"] == "closed"), 0),
                "count",
            ),
            _indicator("fuel_litres_per_km", litres_per_km, "ratio"),
        ],
        charts=[tasks_chart, coverage_chart, incidents_chart, fuel_chart],
        notes=[],
    )


def _open_shifts(member: Membership, effective: Any, filters: DashboardFilters) -> int:  # noqa: ANN401
    motorcycles = apply_area(
        scoped(Motorcycle.objects.all(), member, effective, OPERATIONS_READ),
        filters,
        "center_id",
        None,
    )
    return Shift.objects.filter(
        organization=member.organization,
        status="open",
        motorcycle__in=motorcycles.values("pk"),
    ).count()


def _incident_counts(
    member: Membership, filters: DashboardFilters, start: datetime, end: datetime
) -> tuple[list[dict[str, Any]], int]:
    base = apply_area(
        scoped_incidents(member, OPERATIONS_READ), filters, "center_id", "quadrant_id"
    )
    in_range = base.filter(server_received_at__gte=start, server_received_at__lt=end)
    rows = [
        {"state": row["state"], "count": row["count"]}
        for row in in_range.order_by().values("state").annotate(count=Count("pk")).order_by("state")
    ]
    return rows, base.filter(state="open").count()


def _fuel_chart(  # noqa: PLR0913
    member: Membership,
    effective: Any,  # noqa: ANN401
    filters: DashboardFilters,
    start: datetime,
    end: datetime,
    convention: str,
) -> tuple[Chart, float | None]:
    zone = ZoneInfo(member.organization.timezone)
    day = TruncDate("shift__opened_at_device", tzinfo=zone)
    loads = effective_effects(
        apply_area(
            scoped(FuelLoad.objects.all(), member, effective, OPERATIONS_READ),
            filters,
            "motorcycle__center_id",
            None,
        ).filter(shift__opened_at_device__gte=start, shift__opened_at_device__lt=end),
        "event",
    )
    litres_rows = loads.annotate(day=day).order_by().values("day").annotate(litres=Sum("litres"))
    motorcycles = apply_area(
        scoped(Motorcycle.objects.all(), member, effective, OPERATIONS_READ),
        filters,
        "center_id",
        None,
    )
    km_rows = (
        Shift.objects.filter(
            organization=member.organization,
            status="closed",
            motorcycle__in=motorcycles.values("pk"),
            opened_at_device__gte=start,
            opened_at_device__lt=end,
        )
        .annotate(day=TruncDate("opened_at_device", tzinfo=zone))
        .order_by()
        .values("day")
        .annotate(
            km=Sum(
                ExpressionWrapper(
                    F("odometer_close_km") - F("odometer_open_km"), output_field=IntegerField()
                )
            )
        )
    )
    periods: dict[str, list[Decimal]] = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for row in litres_rows:
        periods[period_key(row["day"], filters.granularity, convention)][0] += row["litres"]
    for row in km_rows:
        periods[period_key(row["day"], filters.granularity, convention)][1] += row["km"] or 0
    ordered = sorted(periods.items())

    def ratio(litres: Decimal, km: Decimal) -> float | None:
        return None if km == 0 else round(float(litres / km), 4)

    total_litres = sum((v[0] for _p, v in ordered), Decimal(0))
    total_km = sum((v[1] for _p, v in ordered), Decimal(0))
    fuel = chart(
        "fuel_per_km",
        "line",
        "litres_per_km",
        [
            Series(
                key="litres_per_km",
                label=label("analytics.series.litres_per_km"),
                points=[{"x": p, "y": ratio(v[0], v[1])} for p, v in ordered],
            )
        ],
        ["period", "litres", "km", "litres_per_km"],
        [
            {
                "period": p,
                "litres": float(v[0]),
                "km": int(v[1]),
                "litres_per_km": ratio(v[0], v[1]),
            }
            for p, v in ordered
        ],
    )
    return fuel, ratio(total_litres, total_km)


# ---------------------------------------------------------------- W53 entomology


def entomology_dashboard(member: Membership, filters: DashboardFilters, now: datetime) -> Dashboard:
    effective = effective_scope(member)
    validate_scope_filters(member, effective, ENTOMOLOGY_READ, filters)
    start, end = filters.bounds(member.organization)
    readings = effective_effects(
        apply_area(
            scoped(OvitrapReading.objects.all(), member, effective, ENTOMOLOGY_READ),
            filters,
            POINT_CENTER,
            POINT_QUADRANT,
        ).filter(event__device_time__gte=start, event__device_time__lt=end),
        "event",
    )
    current_count = (
        LabResultRevision.objects.filter(bag__reading=OuterRef("pk"))
        .order_by("-revision")
        .values("count__value")[:1]
    )
    rows = list(
        readings.annotate(eggs=Subquery(current_count))
        .order_by()
        .values("epi_week", POINT_QUADRANT, "ovitrap__sampling_point__block__quadrant__code")
        .annotate(
            inspected=Count("pk", filter=Q(paddle_present=True, is_index_excluded=False)),
            positive=Count("pk", filter=Q(has_eggs=True, is_index_excluded=False)),
            excluded=Count("pk", filter=Q(is_index_excluded=True)),
            counted=Count("pk", filter=Q(eggs__isnull=False)),
            eggs_total=Sum("eggs"),
        )
        .order_by("epi_week")
    )
    quadrant_code = "ovitrap__sampling_point__block__quadrant__code"
    weeks: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0])
    trend: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for row in rows:
        total = weeks[row["epi_week"]]
        total[0] += row["inspected"]
        total[1] += row["positive"]
        total[2] += row["counted"]
        total[3] += row["eggs_total"] or 0
        cell = trend[row[quadrant_code]][row["epi_week"]]
        cell[0] += row["inspected"]
        cell[1] += row["positive"]
    ordered = sorted(weeks.items())

    index_chart = chart(
        "positive_ovitrap_index",
        "line",
        "percent",
        [
            Series(
                key="index",
                label=label("analytics.series.positive_index"),
                points=[{"x": w, "y": percent(v[1], v[0])} for w, v in ordered],
            )
        ],
        ["epi_week", "inspected", "positive", "index_pct"],
        [
            {"epi_week": w, "inspected": v[0], "positive": v[1], "index_pct": percent(v[1], v[0])}
            for w, v in ordered
        ],
    )
    eggs_chart = chart(
        "eggs_per_ovitrap",
        "line",
        "eggs",
        [
            Series(
                key="eggs_per_ovitrap",
                label=label("analytics.series.eggs_per_ovitrap"),
                points=[
                    {"x": w, "y": None if v[2] == 0 else round(v[3] / v[2], 1)} for w, v in ordered
                ],
            )
        ],
        ["epi_week", "counted", "eggs", "eggs_per_ovitrap"],
        [
            {
                "epi_week": w,
                "counted": v[2],
                "eggs": v[3],
                "eggs_per_ovitrap": None if v[2] == 0 else round(v[3] / v[2], 1),
            }
            for w, v in ordered
        ],
    )
    trend_rows = [
        {
            "quadrant": code,
            "epi_week": w,
            "inspected": v[0],
            "positive": v[1],
            "index_pct": percent(v[1], v[0]),
        }
        for code, per_week in sorted(trend.items())
        for w, v in sorted(per_week.items())
    ]
    trend_chart = chart(
        "index_trend_by_quadrant",
        "line",
        "percent",
        [
            Series(
                key=code,
                label=label("analytics.series.quadrant", quadrant=code),
                points=[{"x": w, "y": percent(v[1], v[0])} for w, v in sorted(per_week.items())],
            )
            for code, per_week in sorted(trend.items())
        ],
        ["quadrant", "epi_week", "inspected", "positive", "index_pct"],
        trend_rows,
    )
    inspected = sum(v[0] for v in weeks.values())
    positive = sum(v[1] for v in weeks.values())
    counted = sum(v[2] for v in weeks.values())
    eggs = sum(v[3] for v in weeks.values())
    excluded = sum(row["excluded"] for row in rows)
    return Dashboard(
        cutoff=now,
        filters=filters.echo(),
        indicators=[
            _indicator("ovitraps_inspected", inspected, "count"),
            _indicator("ovitraps_positive", positive, "count"),
            _indicator("positive_index", percent(positive, inspected), "percent"),
            _indicator(
                "eggs_per_ovitrap", None if counted == 0 else round(eggs / counted, 1), "eggs"
            ),
        ],
        charts=[index_chart, eggs_chart, trend_chart],
        notes=[label("analytics.note.index_excluded", count=excluded)],
    )


# ---------------------------------------------------------------- W54 prevalence


def wolbachia_dashboard(member: Membership, filters: DashboardFilters, now: datetime) -> Dashboard:
    effective = effective_scope(member)
    validate_scope_filters(member, effective, WOLBACHIA_READ, filters)
    organization = member.organization
    convention = organization.epi_week
    start, end = filters.bounds(organization)
    zone = ZoneInfo(organization.timezone)
    samples = apply_area(
        sample_rows(UploadActor(member.user, organization), WOLBACHIA_READ),
        filters,
        "center_id",
        "quadrant_id",
    ).filter(device_time__gte=start, device_time__lt=end)
    rows = (
        valid_results(samples)
        .annotate(day=TruncDate("device_time", tzinfo=zone))
        .order_by()
        .values("day", "quadrant_id", "quadrant__code")
        .annotate(tested=Count("pk"), positive=Count("pk", filter=Q(selected_result="positive")))
    )
    overall: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    per_quadrant: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for row in rows:
        week = period_key(row["day"], "week", convention)
        overall[week][0] += row["tested"]
        overall[week][1] += row["positive"]
        if row["quadrant__code"] is not None:
            cell = per_quadrant[row["quadrant__code"]][week]
            cell[0] += row["tested"]
            cell[1] += row["positive"]

    def point(week: str, values: list[int]) -> dict[str, Any]:
        interval = wilson_interval(values[1], values[0])
        return {
            "x": week,
            "y": percent(values[1], values[0]),
            "n": values[0],
            "ci_low": None if interval is None else interval[0],
            "ci_high": None if interval is None else interval[1],
        }

    series = [
        Series(
            key="all",
            label=label("analytics.series.all_quadrants"),
            points=[point(w, v) for w, v in sorted(overall.items())],
        ),
        *(
            Series(
                key=code,
                label=label("analytics.series.quadrant", quadrant=code),
                points=[point(w, v) for w, v in sorted(cells.items())],
            )
            for code, cells in sorted(per_quadrant.items())
        ),
    ]
    table_rows = [
        {
            "quadrant": code,
            "week": w,
            "tested": v[0],
            "positive": v[1],
            "prevalence_pct": percent(v[1], v[0]),
            "ci_low": (wilson_interval(v[1], v[0]) or (None, None))[0],
            "ci_high": (wilson_interval(v[1], v[0]) or (None, None))[1],
        }
        for code, cells in [("all", overall), *sorted(per_quadrant.items())]
        for w, v in sorted(cells.items())
    ]
    tested = sum(v[0] for v in overall.values())
    positive = sum(v[1] for v in overall.values())
    return Dashboard(
        cutoff=now,
        filters=filters.echo(),
        indicators=[
            _indicator("samples_valid", tested, "count"),
            _indicator("samples_positive", positive, "count"),
            _indicator("prevalence", percent(positive, tested), "percent"),
        ],
        charts=[
            chart(
                "wolbachia_prevalence",
                "line",
                "percent",
                series,
                ["quadrant", "week", "tested", "positive", "prevalence_pct", "ci_low", "ci_high"],
                table_rows,
            )
        ],
        notes=[label("analytics.note.valid_results_only")],
    )


# ---------------------------------------------------------------- home cards


def home_cards(member: Membership, now: datetime) -> list[dict[str, Any]]:
    """Integer cards for the home summary, only for the dashboards the profile may read."""
    effective = effective_scope(member)
    cards: list[dict[str, Any]] = []
    today = now.astimezone(ZoneInfo(member.organization.timezone)).date()
    if OPERATIONS_READ in effective.permissions:
        tasks = tasks_with_completion(
            scoped(
                ScheduledTask.objects.filter(due_date=today), member, effective, OPERATIONS_READ
            ),
            member.organization,
        ).order_by()
        totals = tasks.aggregate(planned=Count("pk"), done=Count("pk", filter=Q(is_completed=True)))
        cards.append(
            _card(
                "tasks_pending_today",
                totals["planned"] - totals["done"],
                "dashboard_operations",
                now,
            )
        )
        cards.append(
            _card(
                "couriers_in_field",
                _open_shifts(
                    member,
                    effective,
                    DashboardFilters(today, today, "day", None, None),
                ),
                "dashboard_operations",
                now,
            )
        )
    return cards


def _card(key: str, value: int, resource: str, now: datetime) -> dict[str, Any]:
    return {"key": key, "value": value, "resource": resource, "filters": {}, "cutoff": now}
