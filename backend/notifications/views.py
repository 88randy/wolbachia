"""Thin authenticated owner-only W5 endpoints."""

from typing import cast
from uuid import UUID

from django.db import transaction
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param

from core.views import OrgScopedViewSetMixin
from notifications import serializers as wire
from notifications.cursors import PageRequest, cursor_page
from notifications.permissions import NOTIFICATION_READ, PREFERENCE_UPDATE
from notifications.selectors import inbox_rows, preference_rows, usable_grants
from notifications.services import lock_inbox_member, mark_all_read, mark_read, update_preferences
from organizations.models import Membership


class NotificationViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    serializer_class = wire.NotificationSerializer
    pagination_class = None
    required_permissions = {
        "list": NOTIFICATION_READ,
        "read": NOTIFICATION_READ,
        "read_all": NOTIFICATION_READ,
    }

    def member(self) -> Membership:
        return cast(Membership, self.request.membership)  # type: ignore[attr-defined]

    @extend_schema(
        parameters=[wire.NotificationQuerySerializer], responses=wire.NotificationPageSerializer
    )
    @transaction.atomic
    def list(self, request: Request) -> Response:
        query = wire.NotificationQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        member = lock_inbox_member(self.member())
        rows = inbox_rows(member)
        page, token = cursor_page(rows, PageRequest(member, query.validated_data))
        return Response(
            {
                "results": wire.NotificationSerializer(
                    page, many=True, context={"member": member}
                ).data,
                "next": replace_query_param(request.build_absolute_uri(), "cursor", token)
                if token
                else None,
                "previous": None,
                "unread_total": rows.filter(read_at__isnull=True).count(),
            }
        )

    @extend_schema(request=None, responses={204: None})
    def read(self, request: Request, pk: str) -> Response:
        _require_empty_body(request)
        try:
            identifier = UUID(pk)
        except ValueError:
            raise Http404 from None
        mark_read(self.member(), identifier)
        return Response(status=204)

    @extend_schema(request=None, responses={204: None})
    def read_all(self, request: Request) -> Response:
        _require_empty_body(request)
        mark_all_read(self.member())
        return Response(status=204)


class NotificationPreferencesViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    serializer_class = wire.NotificationPreferencesSerializer
    required_permissions = {"retrieve": NOTIFICATION_READ, "partial_update": PREFERENCE_UPDATE}

    def member(self) -> Membership:
        return cast(Membership, self.request.membership)  # type: ignore[attr-defined]

    @extend_schema(responses=wire.NotificationPreferencesSerializer)
    def retrieve(self, request: Request) -> Response:
        usable_grants(self.member(), NOTIFICATION_READ)
        return Response({"preferences": preference_rows(self.member())})

    @extend_schema(
        request=wire.NotificationPreferencesPatchSerializer,
        responses=wire.NotificationPreferencesSerializer,
    )
    def partial_update(self, request: Request) -> Response:
        body = wire.NotificationPreferencesPatchSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        update_preferences(self.member(), body.validated_data["preferences"])
        return Response({"preferences": preference_rows(self.member())})


def _require_empty_body(request: Request) -> None:
    body = wire.StrictSerializer(data=request.data)
    body.is_valid(raise_exception=True)
