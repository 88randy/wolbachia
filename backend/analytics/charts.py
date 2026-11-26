"""Response shapes shared by the dashboards: series plus a plain table, labels as code + params."""

from datetime import date
from math import sqrt
from typing import Any, TypedDict

from core.time import epi_week_start

Z_95 = 1.96


class Label(TypedDict):
    code: str
    params: dict[str, Any]


class Series(TypedDict):
    key: str
    label: Label
    points: list[dict[str, Any]]


class Column(TypedDict):
    key: str
    label: Label


class Table(TypedDict):
    columns: list[Column]
    rows: list[dict[str, Any]]


class Chart(TypedDict):
    key: str
    kind: str
    label: Label
    unit: str
    series: list[Series]
    table: Table


class Indicator(TypedDict):
    key: str
    label: Label
    value: float | int | None
    unit: str


def label(code: str, **params: Any) -> Label:  # noqa: ANN401
    return Label(code=code, params=params)


def column(prefix: str, key: str) -> Column:
    return Column(key=key, label=label(f"{prefix}.{key}"))


def chart(  # noqa: PLR0913 -- one flat description of a chart
    key: str,
    kind: str,
    unit: str,
    series: list[Series],
    columns: list[str],
    rows: list[dict[str, Any]],
) -> Chart:
    prefix = f"analytics.{key}"
    return Chart(
        key=key,
        kind=kind,
        label=label(f"{prefix}.title"),
        unit=unit,
        series=series,
        table=Table(columns=[column(prefix, name) for name in columns], rows=rows),
    )


def period_key(day: date, granularity: str, convention: str) -> str:
    """The day itself, or the first day of its epi week of the organization."""
    return day.isoformat() if granularity == "day" else epi_week_start(day, convention).isoformat()


def percent(part: int, whole: int) -> float | None:
    return None if whole == 0 else round(part * 100 / whole, 1)


def wilson_interval(positive: int, tested: int) -> tuple[float, float] | None:
    """95 % Wilson score interval, as percentages; unknown when nothing was tested."""
    if tested == 0:
        return None
    p = positive / tested
    denominator = 1 + Z_95**2 / tested
    centre = (p + Z_95**2 / (2 * tested)) / denominator
    margin = Z_95 * sqrt(p * (1 - p) / tested + Z_95**2 / (4 * tested**2)) / denominator
    return round(max(0.0, centre - margin) * 100, 1), round(min(1.0, centre + margin) * 100, 1)
