"""The `changes.cursor` of `/field/sync/`: a signed token bound to one organization and user.

The cursor says how far the phone has read its review items. It is signed with Django's
`signing` (the secret key), so it cannot be forged or edited, and it carries the organization and
user it was issued for, so a token copied to another session is refused. It is not secret: the
position is visible to whoever holds it.

Two modes keep the pull correct without gaps and without loops. Mid-backlog the cursor is a
strict keyset position `(created_at, id)` of the last item delivered: it always moves forward.
Caught up (`is_tail`) it is a watermark `TAIL_OVERLAP` behind the server clock at the time it was
issued: a row can commit after a later one was read, so the next pulls also re-deliver the last
few seconds and the phone drops the items it already has by id. An item can therefore appear in
up to three consecutive pulls; it is never missed.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from django.core import signing

from field_sync.exceptions import InvalidCursorError

CURSOR_SALT = "field_sync.changes"
TAIL_OVERLAP = timedelta(seconds=5)
CURSOR_MAX_LENGTH = 512


@dataclass(frozen=True)
class ChangesCursor:
    """Where the next pull starts. The default is "from the beginning". In tail mode `created_at`
    is the watermark and `item_id` is None."""

    created_at: datetime | None = None
    item_id: uuid.UUID | None = None
    is_tail: bool = True


def encode_cursor(organization_id: uuid.UUID, user_id: uuid.UUID, cursor: ChangesCursor) -> str:
    payload: dict[str, Any] = {
        "o": str(organization_id),
        "u": str(user_id),
        "t": None if cursor.created_at is None else cursor.created_at.isoformat(),
        "i": None if cursor.item_id is None else str(cursor.item_id),
        "m": "tail" if cursor.is_tail else "strict",
    }
    return signing.dumps(payload, salt=CURSOR_SALT, compress=True)


def decode_cursor(
    token: str | None, organization_id: uuid.UUID, user_id: uuid.UUID
) -> ChangesCursor:
    """The position in a cursor, or `InvalidCursorError` for anything but a cursor this server
    issued for this organization and user. No token means "from the beginning"."""
    if token is None:
        return ChangesCursor()
    try:
        payload = signing.loads(token, salt=CURSOR_SALT)
        if (payload["o"], payload["u"]) != (str(organization_id), str(user_id)):
            raise InvalidCursorError
        created_at = None if payload["t"] is None else datetime.fromisoformat(payload["t"])
        item_id = None if payload["i"] is None else uuid.UUID(payload["i"])
        return ChangesCursor(created_at, item_id, is_tail=payload["m"] == "tail")
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        raise InvalidCursorError from None
