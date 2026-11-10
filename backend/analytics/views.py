"""Thin read-only views: parse filters, delegate to selectors, answer with codes and params."""

from collections.abc import Callable
from datetime import datetime
from typing import cast

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from analytics import selectors
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
