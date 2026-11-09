"""Scoped reported-only predicates and protected stable table order."""

from datetime import datetime
from typing import Any, cast

from django.db.models import Case, F, IntegerField, Q, QuerySet, Value, When
from django.db.models.expressions import OrderBy
from rest_framework import serializers
from rest_framework.filters import OrderingFilter
from rest_framework.request import Request
from rest_framework.views import APIView

from incidents.origins import annotate_creation_origin
from incidents.selectors import scoped_incidents
from organizations.models import Membership

ORDERING_FIELDS = ("code", "created_at", "deadline", "severity")
LOOKUPS = {
    "state": "state",
    "severity": "severity",
    "owner": "owner_id",
    "type_id": "type_version_id",
    "type": "type_version__item_id",
    "center": "center_id",
    "quadrant": "quadrant_id",
    "code": "code",
    "origin": "creation_origin",
}


def reported_workspace(member: Membership, values: dict[str, Any], now: datetime) -> QuerySet[Any]:
    query = annotate_creation_origin(scoped_incidents(member, "incident.read"))
    query = query.filter(
        **{lookup: values[key] for key, lookup in LOOKUPS.items() if key in values}
    )
    predicates = {
        "assigned_to_me": Q(owner_id=member.pk),
        "overdue": Q(state="open", deadline__isnull=False, deadline__lte=now),
        "escalated": Q(state="open", stage__gt=0),
    }
    for key, predicate in predicates.items():
        if key in values:
            query = query.filter(predicate if values[key] == "true" else ~predicate)
    return query.select_related("type_version", "center", "quadrant").prefetch_related(
        "events__created_by"
    )


class IncidentOrderingFilter(OrderingFilter):
    """Delegate fleet unchanged; only reported collection gains strict protected ordering."""

    def filter_queryset(
        self, request: Request, queryset: QuerySet[Any], view: APIView
    ) -> QuerySet[Any]:
        if getattr(view, "action", None) != "list":
            return queryset
        if request.query_params.get("kind", "fleet") != "reported":
            return super().filter_queryset(request, queryset, view)
        raw = request.query_params.get("ordering")
        fields = (
            ["deadline", "created_at"] if raw is None else [item.strip() for item in raw.split(",")]
        )
        if any(field.removeprefix("-") not in ORDERING_FIELDS for field in fields):
            raise serializers.ValidationError({"ordering": "Invalid ordering field."})
        query = queryset.annotate(
            _critical_rank=Case(
                When(severity="critical", then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
            _severity_rank=Case(
                *[
                    When(severity=level, then=Value(index))
                    for index, level in enumerate(("low", "medium", "high", "critical"))
                ],
                output_field=IntegerField(),
            ),
        )
        ordering: list[str | OrderBy] = ["_critical_rank"]
        for field in fields:
            name = field.removeprefix("-")
            expression = F("_severity_rank" if name == "severity" else name)
            ordering.append(
                expression.desc(nulls_last=True)
                if field.startswith("-")
                else expression.asc(nulls_last=True)
            )
        return cast(QuerySet[Any], query.order_by(*ordering, "id"))
