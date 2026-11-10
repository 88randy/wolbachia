"""Signed keysets retain unread rank as observed at the first page's cutoff."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.core import signing
from django.db.models import Case, IntegerField, Q, QuerySet, Value, When
from django.utils.dateparse import parse_datetime
from django_stubs_ext import WithAnnotations

from core.exceptions import FieldValidationError
from core.time import server_now
from notifications.models import Notification
from notifications.selectors import InboxProjection
from organizations.models import Membership
from organizations.services import effective_scope

CURSOR_SALT = "notifications.inbox.v1"
CURSOR_MAX_AGE = 7 * 24 * 60 * 60


class RankedInboxProjection(InboxProjection):
    read_rank: int


@dataclass(frozen=True)
class PageRequest:
    member: Membership
    query: dict[str, Any]


def _binding(request: PageRequest) -> str:
    context = {
        "member": str(request.member.pk),
        "user": str(request.member.user_id),
        "organization": str(request.member.organization_id),
        "scope": [
            (sorted(codes), scope) for codes, scope in effective_scope(request.member).grants
        ],
        "query": {key: value for key, value in request.query.items() if key != "cursor"},
    }
    return hashlib.sha256(json.dumps(context, sort_keys=True).encode()).hexdigest()


def _state(request: PageRequest) -> dict[str, Any]:
    token = request.query.get("cursor")
    if not token:
        return {"binding": _binding(request), "as_of": server_now().isoformat(), "after": None}
    try:
        state = signing.loads(token, salt=CURSOR_SALT, max_age=CURSOR_MAX_AGE)
    except (signing.BadSignature, ValueError, KeyError, TypeError) as error:
        raise FieldValidationError("cursor", "invalid_cursor") from error
    if not isinstance(state, dict) or state.get("binding") != _binding(request):
        raise FieldValidationError("cursor", "invalid_cursor")
    if parse_datetime(state.get("as_of", "")) is None:
        raise FieldValidationError("cursor", "invalid_cursor")
    return state


def cursor_page(
    rows: QuerySet[WithAnnotations[Notification, InboxProjection]], request: PageRequest
) -> tuple[list[WithAnnotations[Notification, RankedInboxProjection]], str | None]:
    """Read receipts after cutoff never reorder an unread row between cursor pages."""
    state = _state(request)
    as_of = parse_datetime(state["as_of"])
    ranked = rows.filter(created_at__lte=as_of).annotate(
        read_rank=Case(
            When(read_at__lte=as_of, then=Value(1)), default=Value(0), output_field=IntegerField()
        )
    )
    rows_ranked = cast("QuerySet[WithAnnotations[Notification, RankedInboxProjection]]", ranked)
    if request.query.get("kind"):
        rows_ranked = rows_ranked.filter(kind=request.query["kind"])
    if "unread" in request.query:
        rows_ranked = rows_ranked.filter(read_rank=0 if request.query["unread"] else 1)
    rows_ranked = _after(rows_ranked, state["after"])
    size = request.query["page_size"]
    page = list(rows_ranked.order_by("read_rank", "-created_at", "-pk")[: size + 1])
    if len(page) <= size:
        return page, None
    last = page[size - 1]
    state["after"] = [last.read_rank, last.created_at.isoformat(), str(last.pk)]
    return page[:size], signing.dumps(state, salt=CURSOR_SALT, compress=True)


def _after(
    rows: QuerySet[WithAnnotations[Notification, RankedInboxProjection]], after: list[Any] | None
) -> QuerySet[WithAnnotations[Notification, RankedInboxProjection]]:
    if after is None:
        return rows
    rank, created, identifier = after
    return rows.filter(
        Q(read_rank__gt=rank)
        | Q(read_rank=rank, created_at__lt=datetime.fromisoformat(created))
        | Q(read_rank=rank, created_at=created, pk__lt=UUID(identifier))
    )
