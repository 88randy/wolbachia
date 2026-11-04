"""The `changes.cursor` of `/field/sync/`: a signed token bound to one organization and user.

The cursor says how far the phone has read its review items: the `courier_sequence` of the last
item delivered (a counter per courier, not a timestamp). It is signed with Django's `signing` (the secret
key), so it cannot be forged or edited; it carries the organization and user it was issued for,
so a token copied to another session is refused; and it expires after
`SYNC_CURSOR_MAX_AGE_SECONDS` (default 7 days). It is not secret: the position is visible to
whoever holds it.

Position by sequence is safe because every writer of a courier's review items holds the same
transaction advisory lock while assigning it and the pull runs under that lock (decision 71): no
item can commit "behind" a cursor that was already issued, whatever the clocks say.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core import signing

from field_sync.exceptions import InvalidCursorError

CURSOR_SALT = "field_sync.changes"
CURSOR_MAX_LENGTH = 512


@dataclass(frozen=True)
class ChangesCursor:
    """Where the next pull starts: after the review item with this `courier_sequence`."""

    sequence: int = 0


def encode_cursor(organization_id: uuid.UUID, user_id: uuid.UUID, cursor: ChangesCursor) -> str:
    payload: dict[str, Any] = {"o": str(organization_id), "u": str(user_id), "s": cursor.sequence}
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
        sequence = payload["s"]
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            raise InvalidCursorError
        return ChangesCursor(sequence)
    except (signing.BadSignature, KeyError, TypeError, ValueError):
        raise InvalidCursorError from None
