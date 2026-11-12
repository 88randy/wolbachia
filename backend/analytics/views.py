"""Thin read-only views: parse filters, delegate to selectors, answer with codes and params."""

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any, cast

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from analytics import selectors
from analytics.comparison import (
    DEFAULT_DAYS,
    ComparisonPermission,
    ComparisonQuerySerializer,
    ComparisonSerializer,
    compare,
    require_center,
)
from analytics.filters import (
    DEFAULT_RANGE_DAYS,
    DashboardFilters,
    DashboardQuerySerializer,
    parse_filters,
)
from analytics.permissions import ENTOMOLOGY_READ, OPERATIONS_READ, WOLBACHIA_READ
from analytics.serializers import DashboardSerializer
from core.time import local_today, server_now
from core.views import OrgScopedViewSetMixin
from organizations.models import Center, Membership

OPERATIONS_DEFAULT_DAYS = 28


class AnalyticsViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = Center.objects.none()
    pagination_class = None
    required_permissions = {
        "operations": OPERATIONS_READ,
        "entomology": ENTOMOLOGY_READ,
        "wolbachia": WOLBACHIA_READ,
    }

    def get_permissions(self) -> list[Any]:
        # The comparison is gated by the indicator asked for, not by one fixed code.
        if getattr(self, "action", None) == "comparison":
            return [IsAuthenticated(), ComparisonPermission()]
        return super().get_permissions()

    def _run(
        self,
        request: Request,
        default_days: int,
        build: Callable[[Membership, DashboardFilters, datetime], selectors.Dashboard],
    ) -> Response:
        query = DashboardQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        member = cast(Membership, request.membership)  # type: ignore[attr-defined]
        now = server_now()
        filters = parse_filters(
            dict(query.validated_data), local_today(member.organization.timezone, now), default_days
        )
        body = DashboardSerializer(build(member, filters, now)).data
        return Response(body, headers={"Cache-Control": "private, no-store"})

    @extend_schema(parameters=[DashboardQuerySerializer], responses=DashboardSerializer)
    def operations(self, request: Request) -> Response:
        return self._run(request, OPERATIONS_DEFAULT_DAYS, selectors.operations_dashboard)

    @extend_schema(parameters=[DashboardQuerySerializer], responses=DashboardSerializer)
    def entomology(self, request: Request) -> Response:
        return self._run(request, DEFAULT_RANGE_DAYS, selectors.entomology_dashboard)

    @extend_schema(parameters=[DashboardQuerySerializer], responses=DashboardSerializer)
    def wolbachia(self, request: Request) -> Response:
        return self._run(request, DEFAULT_RANGE_DAYS, selectors.wolbachia_dashboard)

    @extend_schema(parameters=[ComparisonQuerySerializer], responses=ComparisonSerializer)
    def comparison(self, request: Request) -> Response:
        """W56: one indicator across centers or quadrants, with the previous period."""
        query = ComparisonQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        member = cast(Membership, request.membership)  # type: ignore[attr-defined]
        now = server_now()
        last = data.get("date_to", local_today(member.organization.timezone, now))
        first = data.get("date_from", last - timedelta(days=DEFAULT_DAYS - 1))
        center = data.get("center")
        require_center(member, data["indicator"], center)
        body = compare(member, data["indicator"], data["group_by"], (first, last), center, now)
        return Response(
            ComparisonSerializer(body).data, headers={"Cache-Control": "private, no-store"}
        )
