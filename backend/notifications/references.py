"""Closed object reference allowlist; every projection rechecks the real object's ACL."""

from typing import Any

from django.http import Http404

from incidents.models import Incident
from notifications.models import Notification
from organizations.models import Membership
from organizations.selectors import filter_by_effective_scope
from reviews.models import ReviewItem
from shifts.models import Motorcycle


def safe_reference(row: Notification, member: Membership) -> dict[str, Any] | None:
    if not row.object_kind:
        return None
    target = _target(row, member)
    return {
        "kind": row.object_kind,
        "available": target is not None,
        "id": str(target.pk) if target is not None else None,
        "code": getattr(target, "code", None)
        if target is not None and row.object_kind != "review_item"
        else None,
        "is_voided": _void_state(target),
    }


def _void_state(target: Incident | Motorcycle | ReviewItem | None) -> bool | None:
    if isinstance(target, Incident):
        state = getattr(target, "state", None)
        return state == "voided" if state is not None else None
    if isinstance(target, Motorcycle):
        return target.voided_at is not None
    return None


def _target(row: Notification, member: Membership) -> Incident | Motorcycle | ReviewItem | None:
    from incidents.selectors import scoped_incidents
    from shifts.models import Motorcycle

    if row.object_id is None:
        return None
    if row.object_kind == "review_item":
        return _review(row, member)
    if row.object_kind == "incident":
        return scoped_incidents(member, "incident.read").filter(pk=row.object_id).first()
    if row.object_kind == "motorcycle":
        rows = Motorcycle.objects.filter(organization_id=member.organization_id, pk=row.object_id)
        return filter_by_effective_scope(rows, member, "motorcycle.read").first()
    return None


def _review(row: Notification, member: Membership) -> ReviewItem | None:
    from reviews.actions import visible_review
    from uploads.access import UploadActor

    if row.object_id is None:
        return None
    try:
        return visible_review(
            UploadActor(member.user, member.organization), row.object_id, "review_item.read"
        )
    except Http404:
        return None
