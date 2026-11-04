"""The `changes.cursor` of `/field/sync/`: a signed token bound to one organization and user.

The cursor says how far the phone has read its review items: a strict keyset position
`(created_at, id)` of the last item delivered. It is signed with Django's `signing` (the secret
key), so it cannot be forged or edited; it carries the organization and user it was issued for,
so a token copied to another session is refused; and it expires after
`SYNC_CURSOR_MAX_AGE_SECONDS` (default 7 days). It is not secret: the position is visible to
whoever holds it.

A strict position is safe because every batch of one courier runs under the same transaction
advisory lock and pulls inside it (decision 71): no review item can commit "behind" a cursor
that was already issued.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.conf import settings
from django.core import signing

from field_sync.exceptions import InvalidCursorError

CURSOR_SALT = "field_sync.changes"
CURSOR_MAX_LENGTH = 512


@dataclass(frozen=True)
class ChangesCursor:
    """Where the next pull starts, after `(created_at, item_id)`. The default is "from the
    beginning"."""

    created_at: datetime | None = None
    item_id: uuid.UUID | None = None


def encode_cursor(organization_id: uuid.UUID, user_id: uuid.UUID, cursor: ChangesCursor) -> str:
    payload: dict[str, Any] = {
        "o": str(organization_id),
        "u": str(user_id),
        "t": None if cursor.created_at is None else cursor.created_at.isoformat(),
        "i": None if cursor.item_id is None else str(cursor.item_id),
    }
    return signing.dumps(payload, salt=CURSOR_SALT, compress=True)


def decode_cursor(
    token: str | None, organization_id: uuid.UUID, user_id: uuid.UUID
) -> ChangesCursor:
    """The position in a cursor, or `InvalidCursorError` for anything but a cursor this server
    issued, for this organization and user, less than `SYNC_CURSOR_MAX_AGE_SECONDS` ago. No token
    means "from the beginning"."""
    if token is None:
        return ChangesCursor()
    try:
        payload = signing.loads(
            token, salt=CURSOR_SALT, max_age=settings.SYNC_CURSOR_MAX_AGE_SECONDS
        )
        if (payload["o"], payload["u"]) != (str(organization_id), str(user_id)):
            raise InvalidCursorError
        created_at = None if payload["t"] is None else datetime.fromisoformat(payload["t"])
        item_id = None if payload["i"] is None else uuid.UUID(payload["i"])
        return ChangesCursor(created_at, item_id)
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        raise InvalidCursorError from None
