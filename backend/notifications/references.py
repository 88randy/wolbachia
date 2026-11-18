"""Closed object reference allowlist; every projection rechecks the real object's ACL."""

from collections.abc import Iterable
from typing import Any
from uuid import UUID

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
    return _reference_of(row, _target(row, member))


def _reference_of(
    row: Notification, target: Incident | Motorcycle | ReviewItem | None
) -> dict[str, Any]:
    return {
        "kind": row.object_kind,
        "available": target is not None,
        "id": str(target.pk) if target is not None else None,
        "code": getattr(target, "code", None)
        if target is not None and row.object_kind != "review_item"
        else None,
        "is_voided": _void_state(target),
    }


def safe_references(
    rows: Iterable[Notification], member: Membership
) -> dict[UUID, dict[str, Any] | None]:
    """Apply the real target ACL once per family for this inbox page, including hidden targets."""
    from incidents.selectors import scoped_incidents

    page = list(rows)
    identifiers = {
        kind: {row.object_id for row in page if row.object_kind == kind and row.object_id}
        for kind in ("incident", "motorcycle", "review_item")
    }
    targets: dict[tuple[str, UUID], Incident | Motorcycle | ReviewItem] = {}
    if identifiers["incident"]:
        targets.update(
            (("incident", row.pk), row)
            for row in scoped_incidents(member, "incident.read").filter(
                pk__in=identifiers["incident"]
            )
        )
    if identifiers["motorcycle"]:
        motorcycles = Motorcycle.objects.filter(
            organization_id=member.organization_id, pk__in=identifiers["motorcycle"]
        )
        targets.update(
            (("motorcycle", row.pk), row)
            for row in filter_by_effective_scope(motorcycles, member, "motorcycle.read")
        )
    if identifiers["review_item"]:
        targets.update(
            (("review_item", row.pk), row)
            for row in _visible_reviews(member, identifiers["review_item"])
        )
    return {
        row.pk: None
        if not row.object_kind
        else _reference_of(
            row, None if row.object_id is None else targets.get((row.object_kind, row.object_id))
        )
        for row in page
    }


def _visible_reviews(member: Membership, identifiers: set[UUID]) -> list[ReviewItem]:
    from reviews.actions import visible_review_ids
    from uploads.access import UploadActor

    rows = list(
        ReviewItem.objects.filter(
            organization_id=member.organization_id, pk__in=identifiers
        ).select_related(
            "field_event__organization", "field_event__device", "field_event__created_by"
        )
    )
    if not rows:
        return []
    allowed = set(
        visible_review_ids(UploadActor(member.user, member.organization), rows, "review_item.read")
    )
    return [row for row in rows if row.pk in allowed]


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
