"""Scoped reads for the home, grouped code search and record resolution."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from django.db.models import BooleanField, Case, QuerySet, Value, When
from django.http import Http404

from discovery.sources import SOURCE_BY_TYPE, SOURCES, RecordSource
from incidents.permissions import INCIDENT_READ
from incidents.workspace_queries import reported_workspace
from organizations.models import Membership
from organizations.scope import EffectiveScope
from organizations.services import effective_scope

HOME_LIST_LIMIT = 5
REPORTED = {"kind": "reported"}
OPEN = {**REPORTED, "state": "open"}
CRITICAL = {**OPEN, "severity": "critical"}
OVERDUE = {**REPORTED, "overdue": "true"}
ESCALATED = {**REPORTED, "escalated": "true"}
CARD_FILTERS = {
    "incidents_open": OPEN,
    "incidents_critical": CRITICAL,
    "incidents_overdue": OVERDUE,
    "incidents_escalated": ESCALATED,
}


class SearchHit(TypedDict):
    type: str
    id: str
    code: str
    is_voided: bool


class SearchGroup(TypedDict):
    type: str
    count: int
    hits: list[SearchHit]


@dataclass(frozen=True)
class SearchPage:
    page: int
    page_size: int


@dataclass(frozen=True)
class SearchRequest:
    query: str
    include_voided: bool
    page: SearchPage
    only_type: str | None = None


def readable_sources(effective: EffectiveScope) -> list[RecordSource]:
    """Types hidden by a missing action permission are absent, not empty."""
    return [source for source in SOURCES if source.permission in effective.permissions]


def search_records(member: Membership, request: SearchRequest) -> list[SearchGroup]:
    """Code-prefix search per readable type; counts include only accessible records."""
    effective = effective_scope(member)
    groups: list[SearchGroup] = []
    for source in readable_sources(effective):
        if request.only_type is not None and source.type != request.only_type:
            continue
        rows = source.rows(member, effective).filter(code__istartswith=request.query)
        if source.voided is not None and not request.include_voided:
            rows = rows.exclude(source.voided)
        groups.append(
            SearchGroup(
                type=source.type, count=rows.count(), hits=_hits(source, rows, request.page)
            )
        )
    return groups


def _hits(source: RecordSource, rows: QuerySet[Any], page: SearchPage) -> list[SearchHit]:
    flag = (
        Case(
            When(source.voided, then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        )
        if source.voided is not None
        else Value(False, output_field=BooleanField())
    )
    start = (page.page - 1) * page.page_size
    window = (
        rows.annotate(hit_is_voided=flag)
        .order_by("code", "pk")
        .values_list("pk", "code", "hit_is_voided")[start : start + page.page_size]
    )
    return [
        SearchHit(type=source.type, id=str(pk), code=code, is_voided=is_voided)
        for pk, code, is_voided in window
    ]


def resolve_record(member: Membership, record_type: str, code: str) -> tuple[RecordSource, Any]:
    """Unknown type, unknown code, foreign code and hidden type are all the same 404."""
    source = SOURCE_BY_TYPE.get(record_type)
    effective = effective_scope(member)
    if source is None or source.permission not in effective.permissions:
        raise Http404
    record = source.rows(member, effective).filter(code=code).first()
    if record is None:
        raise Http404
    return source, record


class HomeSummary(TypedDict):
    cutoff: datetime
    cards: list[dict[str, Any]]
    critical: list[dict[str, Any]]
    attention: list[dict[str, Any]]
    link_filters: dict[str, dict[str, Any]]
    support: dict[str, str] | None


def home_summary(member: Membership, now: datetime) -> HomeSummary:
    """Every figure is computed with the filters it links to, so card and list cannot differ."""
    from analytics.selectors import home_cards

    effective = effective_scope(member)
    extra = home_cards(member, now)
    if not readable_sources(effective) and not extra:
        return HomeSummary(
            cutoff=now,
            cards=[],
            critical=[],
            attention=[],
            link_filters={},
            support={"contact": member.organization.support_contact},
        )
    if INCIDENT_READ not in effective.permissions:
        return HomeSummary(
            cutoff=now, cards=extra, critical=[], attention=[], link_filters={}, support=None
        )
    cards = [
        {
            "key": key,
            "value": reported_workspace(member, filters, now).count(),
            "resource": "incidents",
            "filters": filters,
            "cutoff": now,
        }
        for key, filters in CARD_FILTERS.items()
    ]
    cards = [*extra, *cards]
    return HomeSummary(
        cutoff=now,
        cards=cards,
        critical=_incident_items(member, CRITICAL, now),
        attention=_incident_items(member, OVERDUE, now),
        link_filters={
            "critical": {"resource": "incidents", "filters": CRITICAL},
            "attention": {"resource": "incidents", "filters": OVERDUE},
        },
        support=None,
    )


def _incident_items(
    member: Membership, filters: dict[str, Any], now: datetime
) -> list[dict[str, Any]]:
    window = (
        reported_workspace(member, filters, now)
        .order_by("deadline", "code")
        .values("code", "severity", "deadline")[:HOME_LIST_LIMIT]
    )
    return [{"type": "incident", **row} for row in window]
