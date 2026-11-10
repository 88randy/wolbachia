"""Owner and explicit paired-scope inbox projections."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, TypedDict, cast

from django.db.models import DateTimeField, OuterRef, Q, QuerySet, Subquery
from django_stubs_ext import WithAnnotations
from rest_framework.exceptions import PermissionDenied

from notifications.models import Notification, NotificationRead, PreferenceVersion
from notifications.permissions import NOTIFICATION_READ
from organizations.models import Membership
from organizations.scope import WorkScope
from organizations.services import effective_scope


class InboxProjection(TypedDict):
    read_at: datetime | None


def usable_grants(member: Membership, permission: str) -> tuple[WorkScope, ...]:
    """Scope none and empty selected deny, even for an inbox row without an object."""
    grants = tuple(
        scope
        for codes, scope in effective_scope(member).grants
        if permission in codes
        and all(
            dimension["mode"] == "all"
            or (dimension["mode"] == "selected" and bool(dimension["ids"]))
            for dimension in (scope["centers"], scope["quadrants"])
        )
    )
    if not grants:
        raise PermissionDenied
    return grants


def inbox_rows(member: Membership) -> QuerySet[WithAnnotations[Notification, InboxProjection]]:
    """Every count, read action and page starts with the same owner/scope predicate."""
    allowed = Q(pk__in=[])
    lookups: tuple[tuple[Literal["centers", "quadrants"], str], ...] = (
        ("centers", "center_id"),
        ("quadrants", "quadrant_id"),
    )
    for scope in usable_grants(member, NOTIFICATION_READ):
        grant = Q(pk__isnull=False)
        for name, lookup in lookups:
            dimension = scope[name]
            if dimension["mode"] == "selected":
                grant &= Q(**{f"{lookup}__isnull": True}) | Q(**{f"{lookup}__in": dimension["ids"]})
        allowed |= grant
    read = NotificationRead.objects.filter(notification_id=OuterRef("pk"))
    rows = (
        Notification.objects.filter(organization_id=member.organization_id, recipient_id=member.pk)
        .filter(allowed)
        .annotate(read_at=Subquery(read.values("created_at")[:1], output_field=DateTimeField()))
    )
    return cast("QuerySet[WithAnnotations[Notification, InboxProjection]]", rows)


def preference_rows(member: Membership) -> list[dict[str, Any]]:
    """Return policy and current stored values without writing defaults during GET."""
    from notifications.models import NotificationKind

    stored: dict[str, PreferenceVersion] = {}
    for row in PreferenceVersion.objects.filter(
        organization_id=member.organization_id, recipient=member
    ).order_by("kind", "-revision"):
        stored.setdefault(row.kind, row)
    return [_preference(kind, stored.get(kind)) for kind in NotificationKind.values]


def _preference(kind: str, row: PreferenceVersion | None) -> dict[str, Any]:
    required = kind == "critical"
    return {
        "kind": kind,
        "in_app": required or row is None or row.in_app,
        "email": required or (row is not None and row.email),
        "required_in_app": required,
        "required_email": required,
    }
