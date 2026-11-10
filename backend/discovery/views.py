"""Thin views: validate the query, delegate to selectors, answer with codes and params."""

from typing import Any, cast

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle

from core.time import server_now
from core.views import OrgScopedViewSetMixin
from discovery import selectors
from discovery.permissions import HOME_READ
from discovery.selectors import SearchPage, SearchRequest
from discovery.serializers import (
    HistoryQuerySerializer,
    HistoryResponseSerializer,
    HomeSummarySerializer,
    SearchQuerySerializer,
    SearchResponseSerializer,
)
from discovery.timeline import decode_cursor, sources_for, timeline_page
from organizations.models import Center, Membership
from organizations.services import effective_scope


def _record_scope(record_type: str, record: Any) -> tuple[str | None, str | None]:  # noqa: ANN401
    """Center and quadrant of a resolved record, for the permission checks of its sub-sources."""
    if record_type == "sampling_point":
        quadrant = record.block.quadrant
        return str(quadrant.center_id), str(quadrant.pk)
    center = getattr(record, "center_id", None)
    quadrant_id = record.pk if record_type == "quadrant" else getattr(record, "quadrant_id", None)
    return (
        None if center is None else str(center),
        None if quadrant_id is None else str(quadrant_id),
    )


class DiscoveryViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """Home, search and history share one action permission; each type rechecks its own."""

    queryset = Center.objects.none()
    pagination_class = None
    required_permissions = {"summary": HOME_READ, "search": HOME_READ, "history": HOME_READ}

    throttle_scope = "search"

    def get_throttles(self) -> list[BaseThrottle]:
        throttles = super().get_throttles()
        if self.action == "search":
            throttles.append(ScopedRateThrottle())
        return throttles

    def _member(self, request: Request) -> Membership:
        return cast(Membership, request.membership)  # type: ignore[attr-defined]

    @extend_schema(responses=HomeSummarySerializer)
    def summary(self, request: Request) -> Response:
        data = selectors.home_summary(self._member(request), server_now())
        return Response(
            HomeSummarySerializer(data).data, headers={"Cache-Control": "private, no-store"}
        )

    @extend_schema(parameters=[SearchQuerySerializer], responses=SearchResponseSerializer)
    def search(self, request: Request) -> Response:
        query = SearchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        groups = selectors.search_records(
            self._member(request),
            SearchRequest(
                query=values["q"].strip(),
                include_voided=values["include_voided"],
                page=SearchPage(values["page"], values["page_size"]),
                only_type=values.get("type"),
            ),
        )
        body = SearchResponseSerializer({"q": values["q"].strip(), "groups": groups}).data
        return Response(body, headers={"Cache-Control": "private, no-store"})

    @extend_schema(
        parameters=[
            OpenApiParameter("record_type", str, OpenApiParameter.PATH),
            OpenApiParameter("code", str, OpenApiParameter.PATH),
            HistoryQuerySerializer,
        ],
        responses=HistoryResponseSerializer,
    )
    def history(self, request: Request, record_type: str, code: str) -> Response:
        query = HistoryQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values: dict[str, Any] = query.validated_data
        member = self._member(request)
        source, record = selectors.resolve_record(member, record_type, code)
        visible = source.rows(member, effective_scope(member))
        cursor = decode_cursor(values["cursor"]) if "cursor" in values else None
        effective = effective_scope(member)
        center_id, quadrant_id = _record_scope(record_type, record)
        entries, next_cursor = timeline_page(
            sources_for(
                record_type,
                record,
                visible,
                lambda code: effective.allows(code, center_id, quadrant_id),
            ),
            cursor,
            values["page_size"],
        )
        flag = (
            source.voided is not None
            and visible.filter(pk=record.pk).filter(source.voided).exists()
        )
        header = {"type": record_type, "id": record.pk, "code": record.code, "is_voided": flag}
        body = HistoryResponseSerializer(
            {"record": header, "results": entries, "next_cursor": next_cursor}
        ).data
        return Response(body, headers={"Cache-Control": "private, no-store"})
