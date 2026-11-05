"""Resolve choices from the exact delivered catalog version; inactive retained identities review."""

from dataclasses import dataclass
from typing import Any

from catalogs.models import CatalogItem, CatalogSnapshot
from core.models import OTHER_ITEM_CODE
from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.registry import EventContext
from ovitraps import codes


@dataclass(frozen=True)
class CatalogChoice:
    item: CatalogItem
    historical: dict[str, Any]


def resolve_item(snapshot: CatalogSnapshot, slug: str, code: str) -> CatalogChoice:
    """An item must have been offered in the submitted snapshot and retain its org identity."""
    choices = [
        item
        for catalog in snapshot.content["catalogs"]
        if catalog["slug"] == slug
        for item in catalog["items"]
        if item["code"] == code
    ]
    if not choices:
        raise EventRejected(codes.CATALOG_UNKNOWN)
    historical = choices[0]
    item = CatalogItem.objects.filter(
        organization_id=snapshot.organization_id,
        catalog__organization_id=snapshot.organization_id,
        catalog__slug=slug,
        pk=historical["id"],
        code=code,
    ).first()
    if item is None:
        raise EventRejected(codes.CATALOG_UNKNOWN)
    return CatalogChoice(item, historical)


def validate_choices(
    ctx: EventContext, payload: dict[str, Any]
) -> tuple[CatalogChoice, CatalogChoice | None]:
    snapshot = CatalogSnapshot.objects.filter(
        organization=ctx.organization, version=ctx.envelope.catalog_version
    ).first()
    if snapshot is None:
        raise EventNeedsReview(codes.CATALOG_VERSION_UNAVAILABLE)
    finding = resolve_item(snapshot, "ovitrap-finding", payload["finding"])
    paddle = (
        resolve_item(snapshot, "paddle-type", payload["paddle_type"])
        if payload["paddle_type"] is not None
        else None
    )
    validate_other_text(
        payload, (finding.historical, None if paddle is None else paddle.historical)
    )
    if payload["paddle_present"] and (paddle is None or payload["bag_code"] is None):
        raise EventRejected(
            INVALID_PAYLOAD, {"fields": {"bag_code": ["paddle_requires_bag_and_type"]}}
        )
    if not payload["paddle_present"] and (paddle is not None or payload["bag_code"] is not None):
        raise EventRejected(
            INVALID_PAYLOAD, {"fields": {"bag_code": ["no_paddle_has_no_bag_or_type"]}}
        )
    if any(choice is not None and not choice.item.is_active for choice in (finding, paddle)):
        raise EventNeedsReview(codes.CATALOG_DEACTIVATED)
    return finding, paddle


def validate_other_text(
    payload: dict[str, Any], choices: tuple[dict[str, Any] | None, ...]
) -> None:
    """Other requires visible text; regular choices must not carry an unrelated note."""
    from core.void_reason import visible_length

    is_other = any(
        item is not None and (item["is_other"] or item["code"] == OTHER_ITEM_CODE)
        for item in choices
    )
    has_text = bool(visible_length(payload["other_text"]))
    if is_other != has_text or (not is_other and payload["other_text"]):
        raise EventRejected(
            INVALID_PAYLOAD,
            {"fields": {"other_text": ["required_for_other" if is_other else "forbidden"]}},
        )
